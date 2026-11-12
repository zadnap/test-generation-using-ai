import { Metadata } from '@grpc/grpc-js';
import { Logger } from '@nestjs/common';
import { Observable, Subject, Subscription, lastValueFrom } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ClientGrpcProxy } from '../../../../packages/microservices/client/client-grpc.js';
import { GRPC_DEFAULT_URL } from '../../../../packages/microservices/constants.js';
import { InvalidGrpcPackageException } from '../../../../packages/microservices/errors/invalid-grpc-package.exception.js';
import { InvalidGrpcServiceException } from '../../../../packages/microservices/errors/invalid-grpc-service.exception.js';
import { InvalidProtoDefinitionException } from '../../../../packages/microservices/errors/invalid-proto-definition.exception.js';

const asAny = (value: unknown) => value as any;

const defaultOptions = () => ({ package: 'test', protoPath: 'test.proto' });

/**
 * Builds a proxy whose proto loading is replaced by a fixed list of "grpc
 * clients", so no proto file, channel or connection is ever touched.
 */
function createProxy(options: any = defaultOptions(), clients: any[] = []) {
  const fakeClients = clients;
  class Proxy extends ClientGrpcProxy {
    public createClients() {
      return fakeClients;
    }
  }
  return new Proxy(options) as ClientGrpcProxy;
}

/** Same, but `loadProto()` is replaced to exercise createClients(). */
function createProxyWithProto(options: any, protoContext: any) {
  const context = protoContext;
  class Proxy extends ClientGrpcProxy {
    public loadProto() {
      return context;
    }
  }
  return new Proxy(options) as ClientGrpcProxy;
}

const silenceLogger = (proxy: ClientGrpcProxy) =>
  vi.spyOn(asAny(proxy).logger, 'error').mockImplementation(() => {});

const createStreamCall = () => {
  const listeners: Record<string, Function[]> = {};
  const call: any = {
    listeners,
    on: vi.fn((event: string, callback: Function) => {
      (listeners[event] ??= []).push(callback);
      return call;
    }),
    off: vi.fn(),
    emit(event: string, ...args: unknown[]) {
      (listeners[event] ?? []).slice().forEach(cb => cb(...args));
    },
    write: vi.fn(() => true),
    end: vi.fn(),
    cancel: vi.fn(),
    destroy: vi.fn(),
    removeAllListeners: vi.fn(),
    finished: false,
  };
  return call;
};

const createUnaryCall = () => ({ finished: false, cancel: vi.fn() });

const createClientStreamCall = () => ({
  finished: false,
  cancel: vi.fn(),
  destroy: vi.fn(),
  write: vi.fn(),
  end: vi.fn(),
});

// Keeps the real subscription while making it observable to the test
const trackSubscription = (subject: Subject<any>) => {
  const realSubscribe = subject.subscribe.bind(subject);
  let subscription!: Subscription;
  vi.spyOn(subject, 'subscribe').mockImplementation(((...args: any[]) => {
    subscription = realSubscribe(...(args as [any]));
    return subscription;
  }) as any);
  return () => subscription;
};

const createUnaryMethod = (
  call: any = { finished: true },
  result: unknown = { ok: true },
) => {
  const method: any = vi.fn((...args: any[]) => {
    const callback = args[args.length - 1];
    callback(null, result);
    return call;
  });
  return method;
};

// The arguments a unary call got, without its trailing response callback
const argsBeforeCallback = (method: any) => method.mock.calls[0].slice(0, -1);

/**
 * Constructor decisions:
 * D1 `getOptionsProp(options, 'url') || GRPC_DEFAULT_URL` (T: url given,
 *    F: url missing -> default URL).
 * D2 `getOptionsProp(options, 'protoLoader') || GRPC_DEFAULT_PROTO_LOADER`
 *    (T: custom loader, F: default loader). Both loaders resolve to the
 *    installed @grpc/proto-loader, so nothing is fetched in either case.
 * The limits, channel options and graceful shutdown settings are not read
 * here: they belong to createClientByServiceName() and (server side) close().
 */
describe('ClientGrpcProxy constructor', () => {
  it('uses the given url and package list', () => {
    const proxy = createProxy({
      url: '10.0.0.1:1234',
      package: ['a', 'b'],
      protoPath: 'x.proto',
    });

    expect(asAny(proxy).url).toBe('10.0.0.1:1234');
  });

  it('falls back to the default url', () => {
    const proxy = createProxy({ package: 'test', protoPath: 'x.proto' });

    expect(asAny(proxy).url).toBe(GRPC_DEFAULT_URL);
  });

  it('accepts a custom proto loader', () => {
    const proxy = createProxy({
      package: 'test',
      protoPath: 'x.proto',
      protoLoader: '@grpc/proto-loader',
    });

    expect(asAny(proxy).grpcClients).toEqual([]);
  });

  it('uses the default proto loader and creates the clients it is given', () => {
    const clients = [{ test: () => undefined }];
    const proxy = createProxy(
      { package: 'test', protoPath: 'x.proto' },
      clients,
    );

    expect(asAny(proxy).grpcClients).toBe(clients);
  });
});

/**
 * createClients() decisions:
 * D1 `Array.isArray(packageOption)` (T: several packages, F: one package).
 * D2 `if (!grpcPkg)` (T: unknown package -> InvalidGrpcPackageException,
 *    F: package found).
 */
describe('ClientGrpcProxy.createClients', () => {
  it('loads a single package', () => {
    const proxy = createProxyWithProto(
      { package: 'a', protoPath: 'x.proto' },
      { a: { Svc: 'definition' } },
    );

    expect(asAny(proxy).grpcClients).toEqual([{ Svc: 'definition' }]);
  });

  it('loads every package of an array', () => {
    const proxy = createProxyWithProto(
      { package: ['a', 'b'], protoPath: 'x.proto' },
      { a: { SvcA: 'a' }, b: { SvcB: 'b' } },
    );

    expect(asAny(proxy).grpcClients).toEqual([{ SvcA: 'a' }, { SvcB: 'b' }]);
  });

  it('throws InvalidGrpcPackageException for an unknown package', () => {
    expect.assertions(1);
    const loggerError = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    try {
      expect(() =>
        createProxyWithProto({ package: 'missing', protoPath: 'x.proto' }, {}),
      ).toThrow(InvalidGrpcPackageException);
    } finally {
      loggerError.mockRestore();
    }
  });
});

/**
 * loadProto() decisions:
 * D1 try/catch: T (loadPackageDefinition succeeds), F (it throws).
 * D2 `err && err.message` (F: the thrown value is not an Error, the fallback
 *    message is used; T: the mutex error carries its message).
 */
describe('ClientGrpcProxy.loadProto', () => {
  it('returns the definition loaded from a packageDefinition', () => {
    // `{ test: {} }` is a valid (empty) package definition for grpc-js
    const proxy = new ClientGrpcProxy({
      package: 'test',
      packageDefinition: { test: {} },
    } as any);

    expect(Object.keys(proxy.loadProto())).toEqual(['test']);
  });

  it('throws InvalidProtoDefinitionException when protoPath and packageDefinition are both given', () => {
    const loggerError = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    try {
      expect(
        () =>
          new ClientGrpcProxy({
            package: 'test',
            protoPath: 'x.proto',
            packageDefinition: { test: {} },
          } as any),
      ).toThrow(InvalidProtoDefinitionException);
      expect(loggerError).toHaveBeenCalledWith(
        expect.stringContaining('Both protoPath and packageDefinition'),
        expect.anything(),
      );
    } finally {
      loggerError.mockRestore();
    }
  });

  it('falls back to its own message when the thrown value has none', () => {
    const definition: any = {};
    Object.defineProperty(definition, 'test', {
      enumerable: true,
      get() {
        throw 'not an error';
      },
    });
    const loggerError = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    try {
      expect(
        () =>
          new ClientGrpcProxy({
            package: 'test',
            packageDefinition: definition,
          } as any),
      ).toThrow(InvalidProtoDefinitionException);
      expect(loggerError).toHaveBeenCalledWith(
        'The invalid .proto definition (file at "undefined" not found)',
        expect.anything(),
      );
    } finally {
      loggerError.mockRestore();
    }
  });
});

/**
 * createClientByServiceName() decisions:
 * D1 `if (!clientRef)` (T: unknown service, F: found).
 * D2/D3/D4 each `this.options && this.options.max*MessageLength|maxMetadataSize`
 *    (D2/D3/D4 first condition F: options undefined - the function then throws
 *    in getKeepaliveOptions; second condition T/F: limit set or not).
 * D5 `this.options.credentials || grpcPackage.credentials.createInsecure()`
 *    (T: custom credentials, F: insecure ones).
 */
describe('ClientGrpcProxy.createClientByServiceName', () => {
  it('throws InvalidGrpcServiceException when the service is unknown', () => {
    const proxy = createProxy({});

    expect(() => proxy.createClientByServiceName('test')).toThrow(
      InvalidGrpcServiceException,
    );
  });

  it('creates the client with the url, credentials and channel options', () => {
    const created: any = {};
    const Service = vi.fn(function () {
      return created;
    });
    const credentials = { custom: true };
    const proxy = createProxy(
      {
        url: 'svc:1',
        credentials,
        channelOptions: { 'grpc.primary_user_agent': 'app' },
        maxSendMessageLength: 1,
        maxReceiveMessageLength: 2,
        maxMetadataSize: 3,
        keepalive: { keepaliveTimeMs: 10, unknown: 20 },
      },
      [{ test: Service }],
    );

    const client = proxy.createClientByServiceName('test');

    expect(client).toBe(created);
    expect(asAny(proxy).clients.get('test')).toBe(created);
    expect(Service.mock.calls[0]).toEqual([
      'svc:1',
      credentials,
      {
        'grpc.primary_user_agent': 'app',
        'grpc.max_send_message_length': 1,
        'grpc.max_receive_message_length': 2,
        'grpc.max_metadata_size': 3,
        'grpc.keepalive_time_ms': 10,
      },
    ]);
  });

  it('uses insecure credentials and no limits when none are configured', () => {
    const Service = vi.fn();
    const proxy = createProxy({ url: 'svc:2' }, [{ test: Service }]);

    proxy.createClientByServiceName('test');

    const [, credentials, options] = Service.mock.calls[0];
    expect(credentials).toBeDefined();
    expect(credentials).not.toEqual({ custom: true });
    expect(options).toEqual({});
  });

  it('throws when the options are undefined (limit guards skipped)', () => {
    const Service = vi.fn();
    const proxy = createProxy(null as any, [{ test: Service }]);

    expect(() => proxy.createClientByServiceName('test')).toThrow(TypeError);
    expect(Service).not.toHaveBeenCalled();
  });
});

/**
 * getClient()/getClientByServiceName() decisions:
 * `this.clients.get(name) || this.createClientByServiceName(name)` (T cached,
 * F created); `find(...)` (found / not found).
 */
describe('ClientGrpcProxy.getClientByServiceName', () => {
  it('returns a cached client', () => {
    const proxy = createProxy({});
    asAny(proxy).clients.set('cached', 'client');

    expect(proxy.getClientByServiceName('cached')).toBe('client');
  });

  it('creates the client when it is not cached', () => {
    const proxy = createProxy({});
    const created = vi
      .spyOn(proxy, 'createClientByServiceName')
      .mockReturnValue('created');

    expect(proxy.getClientByServiceName('fresh')).toBe('created');
    expect(created).toHaveBeenCalledWith('fresh');
  });
});

describe('ClientGrpcProxy.getClient', () => {
  it('finds the grpc client that owns the service name', () => {
    const owner = { test: 'definition' };
    const proxy = createProxy({}, [owner]);

    expect(asAny(proxy).getClient('test')).toBe(owner);
  });

  it('returns undefined when no grpc client owns the name', () => {
    const proxy = createProxy({}, [{ other: 'definition' }]);

    expect(asAny(proxy).getClient('test')).toBeUndefined();
  });
});

/** getService() decisions: `if (!clientRef)` (T: throw, F: build methods). */
describe('ClientGrpcProxy.getService', () => {
  it('throws InvalidGrpcServiceException for an unknown service', () => {
    const proxy = createProxy({}, [{ other: function Other() {} }]);

    expect(() => proxy.getService('test')).toThrow(InvalidGrpcServiceException);
  });

  it('builds one method per proto method', () => {
    function Service() {}
    Service.prototype = {
      find: { responseStream: false },
      list: { responseStream: true },
    } as any;
    const proxy = createProxy({}, [{ test: Service }]);
    const createServiceMethod = vi
      .spyOn(proxy, 'createServiceMethod')
      .mockImplementation(() => vi.fn() as any);

    const service = proxy.getService<Record<string, any>>('test');

    expect(Object.keys(service)).toEqual(['find', 'list']);
    expect(createServiceMethod).toHaveBeenCalledTimes(2);
    expect(createServiceMethod.mock.calls[1][1]).toBe('list');
  });
});

/** createServiceMethod() decision: `client[methodName].responseStream` (T/F). */
describe('ClientGrpcProxy.createServiceMethod', () => {
  it('creates a stream method for a response stream', () => {
    const proxy = createProxy({});
    const streamSpy = vi
      .spyOn(proxy, 'createStreamServiceMethod')
      .mockReturnValue(vi.fn() as any);
    const unarySpy = vi.spyOn(proxy, 'createUnaryServiceMethod');

    proxy.createServiceMethod({ m: { responseStream: true } }, 'm');

    expect(streamSpy).toHaveBeenCalledTimes(1);
    expect(unarySpy).not.toHaveBeenCalled();
  });

  it('creates a unary method otherwise', () => {
    const proxy = createProxy({});
    const unarySpy = vi
      .spyOn(proxy, 'createUnaryServiceMethod')
      .mockReturnValue(vi.fn() as any);
    const streamSpy = vi.spyOn(proxy, 'createStreamServiceMethod');

    proxy.createServiceMethod({ m: { responseStream: false } }, 'm');

    expect(unarySpy).toHaveBeenCalledTimes(1);
    expect(streamSpy).not.toHaveBeenCalled();
  });
});

/**
 * createStreamServiceMethod() decisions:
 * D1 `upstreamSubjectOrData && isFunction(upstreamSubjectOrData.subscribe)`
 *    (T: subject upstream, F: no argument / plain data).
 * D2 `isRequestStream && isUpstreamSubject` (T: the upstream is piped into the
 *    call, F: the first argument is sent as the request).
 * D3 `error.details === GRPC_CANCELLED` (T/F).
 * D4 `if (isClientCanceled)` (T: swallowed, F: forwarded).
 * D5 `if (upstreamSubscription)` inside "end" (T/F) and in the teardown (T/F).
 * D6 `if (call.finished)` in the teardown (T: no cancel, F: cancel).
 */
describe('ClientGrpcProxy.createStreamServiceMethod', () => {
  it('returns an observable', () => {
    const proxy = createProxy({});
    const fn = proxy.createStreamServiceMethod({ m: {} }, 'm');

    expect(fn()).toBeInstanceOf(Observable);
  });

  it('forwards data and completes, cancelling an unfinished call', () => {
    const proxy = createProxy({});
    const call = createStreamCall();
    const next = vi.fn();
    const complete = vi.fn();

    proxy
      .createStreamServiceMethod({ m: vi.fn(() => call) }, 'm')()
      .subscribe({ next, complete });
    call.emit('data', 'a');
    call.emit('end');

    expect(next).toHaveBeenCalledWith('a');
    expect(complete).toHaveBeenCalledTimes(1);
    expect(call.removeAllListeners).toHaveBeenCalled();
    expect(call.cancel).toHaveBeenCalledTimes(1);
    expect(call.finished).toBe(false);
  });

  it('does not cancel a finished call', () => {
    const proxy = createProxy({});
    const call = createStreamCall();
    call.finished = true;

    proxy
      .createStreamServiceMethod({ m: vi.fn(() => call) }, 'm')()
      .subscribe();

    expect(call.cancel).not.toHaveBeenCalled();
  });

  it('pipes a request stream into the call and stops on end', () => {
    const proxy = createProxy({});
    const call = createStreamCall();
    const upstream = new Subject<string>();
    const subscription = trackSubscription(upstream);
    const method: any = vi.fn(() => call);
    method.requestStream = true;
    method.responseStream = true;

    proxy.createStreamServiceMethod({ m: method }, 'm')(upstream).subscribe();
    upstream.next('a');
    upstream.complete();

    expect(method).toHaveBeenCalledWith();
    expect(call.write).toHaveBeenCalledWith('a');
    expect(call.end).toHaveBeenCalledTimes(1);

    call.emit('end');
    expect(subscription().closed).toBe(true);
  });

  it('sends the first argument when the upstream is not a subject', () => {
    const proxy = createProxy({});
    const call = createStreamCall();
    const method: any = vi.fn(() => call);
    method.requestStream = true;

    proxy
      .createStreamServiceMethod({ m: method }, 'm')({ id: 1 }, { deadline: 1 })
      .subscribe();

    expect(method.mock.calls[0]).toEqual([{ id: 1 }, { deadline: 1 }]);
  });

  it('forwards a subject as the request when the method does not stream requests', () => {
    const proxy = createProxy({});
    const call = createStreamCall();
    const method: any = vi.fn(() => call);
    const upstream = new Subject<number>();

    proxy.createStreamServiceMethod({ m: method }, 'm')(upstream).subscribe();

    expect(method.mock.calls[0]).toEqual([upstream]);
  });

  it('handles a call without arguments', () => {
    const proxy = createProxy({});
    const call = createStreamCall();
    const method: any = vi.fn(() => call);

    proxy.createStreamServiceMethod({ m: method }, 'm')().subscribe();

    expect(method.mock.calls[0]).toEqual([]);
  });

  it('destroys the call and forwards an error that is not a cancellation', () => {
    const proxy = createProxy({});
    const call = createStreamCall();
    const errorSpy = vi.fn();
    const error = new Error('boom');

    proxy
      .createStreamServiceMethod({ m: vi.fn(() => call) }, 'm')()
      .subscribe({ error: errorSpy });
    call.emit('error', error);

    expect(call.destroy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(error);
  });

  it('destroys the call but swallows a cancellation after the client cancelled', () => {
    const proxy = createProxy({});
    const call = createStreamCall();
    const errorSpy = vi.fn();
    const subscription = proxy
      .createStreamServiceMethod({ m: vi.fn(() => call) }, 'm')()
      .subscribe({ error: errorSpy });

    subscription.unsubscribe();
    call.emit('error', { details: 'Cancelled' });

    expect(call.destroy).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('destroys the call and forwards a cancellation the client did not cause', () => {
    const proxy = createProxy({});
    const call = createStreamCall();
    const errorSpy = vi.fn();
    const cancellation = { details: 'Cancelled' };

    proxy
      .createStreamServiceMethod({ m: vi.fn(() => call) }, 'm')()
      .subscribe({ error: errorSpy });
    call.emit('error', cancellation);

    expect(call.destroy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(cancellation);
  });

  it('unsubscribes from the upstream when the client unsubscribes', () => {
    const proxy = createProxy({});
    const call = createStreamCall();
    const upstream = new Subject<number>();
    const subscription$ = trackSubscription(upstream);
    const method: any = vi.fn(() => call);
    method.requestStream = true;

    const subscription = proxy
      .createStreamServiceMethod(
        { m: method },
        'm',
      )(upstream)
      .subscribe();
    subscription.unsubscribe();

    expect(subscription$().closed).toBe(true);
    expect(call.cancel).toHaveBeenCalledTimes(1);
  });
});

/**
 * createUnaryServiceMethod() decisions:
 * D1 `isRequestStream && isUpstreamSubject` (T: client streaming branch,
 *    F: plain unary call).
 * D2 `if (error)` inside the client streaming response callback (T/F).
 * D3 `error.details === GRPC_CANCELLED || error.code === 1` (T via details,
 *    T via code, F: neither).
 * D4 `if (isClientCanceled)` (T: swallowed, F: forwarded).
 * D5 `if (!call.finished)` in both teardowns (T: cancel, F: leave it).
 */
describe('ClientGrpcProxy.createUnaryServiceMethod', () => {
  it('returns an observable and forwards the response', () => {
    const proxy = createProxy({});
    const next = vi.fn();
    const complete = vi.fn();
    const method = createUnaryMethod();

    const result$ = proxy.createUnaryServiceMethod({ m: method }, 'm')();
    result$.subscribe({ next, complete });

    expect(method).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith({ ok: true });
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('forwards a call error', () => {
    const proxy = createProxy({});
    const errorSpy = vi.fn();
    const error = new Error('failed');
    const call = createUnaryCall();
    let respond!: (err: unknown, data?: unknown) => void;
    const method: any = vi.fn((callback: any) => {
      respond = callback;
      return call;
    });

    proxy.createUnaryServiceMethod({ m: method }, 'm')().subscribe({
      error: errorSpy,
    });
    respond(error);

    expect(errorSpy).toHaveBeenCalledWith(error);
  });

  it('cancels the call when the client unsubscribes', () => {
    const proxy = createProxy({});
    const call = createUnaryCall();
    const method: any = vi.fn(() => call);

    proxy
      .createUnaryServiceMethod({ m: method }, 'm')()
      .subscribe()
      .unsubscribe();

    expect(call.cancel).toHaveBeenCalledTimes(1);
  });

  it('does not cancel a finished call', () => {
    const proxy = createProxy({});
    const call = createUnaryCall();
    call.finished = true;
    const method: any = vi.fn(() => call);

    proxy
      .createUnaryServiceMethod({ m: method }, 'm')()
      .subscribe()
      .unsubscribe();

    expect(call.cancel).not.toHaveBeenCalled();
  });

  describe('when the request is a stream', () => {
    const createClientStreaming = () => {
      const call = createClientStreamCall();
      let respond!: (err: unknown, data?: unknown) => void;
      const method: any = vi.fn((callback: any) => {
        respond = callback;
        return call;
      });
      method.requestStream = true;
      return {
        call,
        method,
        respond: (e: unknown, d?: unknown) => respond(e, d),
      };
    };

    it('writes the upstream values and ends the call', () => {
      const proxy = createProxy({});
      const { call, method } = createClientStreaming();
      const upstream = new Subject<string>();

      proxy.createUnaryServiceMethod({ m: method }, 'm')(upstream).subscribe();
      upstream.next('a');
      upstream.complete();

      expect(call.write).toHaveBeenCalledWith('a');
      expect(call.end).toHaveBeenCalledTimes(1);
    });

    it('forwards a response', () => {
      const proxy = createProxy({});
      const { method, respond } = createClientStreaming();
      const next = vi.fn();

      proxy
        .createUnaryServiceMethod(
          { m: method },
          'm',
        )(new Subject())
        .subscribe({ next });
      respond(null, 'response');

      expect(next).toHaveBeenCalledWith('response');
    });

    it('destroys the call and swallows a cancellation after unsubscribing', () => {
      const proxy = createProxy({});
      const { call, method, respond } = createClientStreaming();
      const errorSpy = vi.fn();

      proxy
        .createUnaryServiceMethod(
          { m: method },
          'm',
        )(new Subject())
        .subscribe({ error: errorSpy })
        .unsubscribe();
      respond({ details: 'Cancelled' });

      expect(call.destroy).toHaveBeenCalledTimes(1);
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('destroys the call and forwards a cancellation identified by details', () => {
      const proxy = createProxy({});
      const { call, method, respond } = createClientStreaming();
      const errorSpy = vi.fn();
      const cancellation = { details: 'Cancelled' };

      proxy
        .createUnaryServiceMethod(
          { m: method },
          'm',
        )(new Subject())
        .subscribe({ error: errorSpy });
      respond(cancellation);

      expect(call.destroy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(cancellation);
    });

    it('destroys the call and forwards a cancellation identified by code 1', () => {
      const proxy = createProxy({});
      const { call, method, respond } = createClientStreaming();
      const errorSpy = vi.fn();
      const cancellation = { code: 1, details: 'other' };

      proxy
        .createUnaryServiceMethod(
          { m: method },
          'm',
        )(new Subject())
        .subscribe({ error: errorSpy });
      respond(cancellation);

      expect(call.destroy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(cancellation);
    });

    it('forwards an error that is not a cancellation without destroying the call', () => {
      const proxy = createProxy({});
      const { call, method, respond } = createClientStreaming();
      const errorSpy = vi.fn();
      const error = { code: 2, details: 'unknown' };

      proxy
        .createUnaryServiceMethod(
          { m: method },
          'm',
        )(new Subject())
        .subscribe({ error: errorSpy });
      respond(error);

      expect(call.destroy).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(error);
    });

    it('cancels an unfinished call on unsubscribe', () => {
      const proxy = createProxy({});
      const { call, method } = createClientStreaming();

      proxy
        .createUnaryServiceMethod(
          { m: method },
          'm',
        )(new Subject())
        .subscribe()
        .unsubscribe();

      expect(call.cancel).toHaveBeenCalledTimes(1);
    });

    it('leaves a finished call alone on unsubscribe', () => {
      const proxy = createProxy({});
      const { call, method } = createClientStreaming();
      call.finished = true;

      proxy
        .createUnaryServiceMethod(
          { m: method },
          'm',
        )(new Subject())
        .subscribe()
        .unsubscribe();

      expect(call.cancel).not.toHaveBeenCalled();
    });
  });
});

/**
 * applyDispatchHook() decisions (reached through the service methods):
 * D1 `if (!this.onDispatchHook)` (T: arguments untouched, F: hook runs).
 * D2 `client[methodName]?.path ?? methodName` (T: method path, F: method name).
 * D3 `if (!hasPacketMetadata(packet.metadata))` (T: no/empty metadata,
 *    F: metadata attached).
 * D4 `maybeMetadata instanceof grpcPackage.Metadata` (T: cloned, F: new).
 * D5 `metadata.get(key).length === 0` (T: added, F: the caller's value wins).
 * D6 `isMetadata || isNil(maybeMetadata)` (T: metadata in second place,
 *    F: call options kept in third place).
 */
describe('ClientGrpcProxy applyDispatchHook', () => {
  it('passes the arguments through without a hook', async () => {
    const proxy = createProxy({});
    const method = createUnaryMethod();

    await lastValueFrom(
      proxy.createServiceMethod({ find: method }, 'find')({ id: 1 }),
    );

    expect(argsBeforeCallback(method)).toEqual([{ id: 1 }]);
  });

  it('passes the arguments through when the hook attaches no metadata', async () => {
    const proxy = createProxy({});
    const method = createUnaryMethod();
    const hook = vi.fn((packet: any) => {
      packet.metadata = {};
    });
    proxy.setOnDispatchHook(hook);

    await lastValueFrom(
      proxy.createServiceMethod({ find: method }, 'find')({ id: 1 }),
    );

    expect(hook).toHaveBeenCalledTimes(1);
    expect(argsBeforeCallback(method)).toEqual([{ id: 1 }]);
  });

  it('names the packet after the method and sends the metadata first', async () => {
    const proxy = createProxy({});
    const method = createUnaryMethod();
    const hook = vi.fn((packet: any) => {
      packet.metadata = { 'x-request-id': 'trace-1' };
    });
    proxy.setOnDispatchHook(hook);

    await lastValueFrom(
      proxy.createServiceMethod({ find: method }, 'find')({ id: 1 }),
    );

    expect(hook.mock.calls[0][0]).toMatchObject({
      pattern: 'find',
      data: { id: 1 },
    });
    const [data, metadata] = argsBeforeCallback(method);
    expect(data).toEqual({ id: 1 });
    expect(metadata).toBeInstanceOf(Metadata);
    expect(metadata.get('x-request-id')).toEqual(['trace-1']);
  });

  it('names the packet after the method path when the method has one', async () => {
    const proxy = createProxy({});
    const method = createUnaryMethod();
    Object.assign(method, { path: '/test.TestService/Find' });
    const hook = vi.fn((packet: any) => {
      packet.metadata = {};
    });
    proxy.setOnDispatchHook(hook);

    await lastValueFrom(
      proxy.createServiceMethod({ find: method }, 'find')({}),
    );

    expect(hook.mock.calls[0][0].pattern).toBe('/test.TestService/Find');
  });

  it('clones the caller metadata and keeps its own values', async () => {
    const proxy = createProxy({});
    const method = createUnaryMethod();
    proxy.setOnDispatchHook((packet: any) => {
      packet.metadata = { 'x-request-id': 'trace-1', tenant: 'acme' };
    });
    const callerMetadata = new Metadata();
    callerMetadata.set('x-request-id', 'own-id');

    await lastValueFrom(
      proxy.createServiceMethod({ find: method }, 'find')({}, callerMetadata),
    );

    const [, metadata] = argsBeforeCallback(method);
    expect(metadata).not.toBe(callerMetadata);
    expect(metadata.get('x-request-id')).toEqual(['own-id']);
    expect(metadata.get('tenant')).toEqual(['acme']);
    expect(callerMetadata.get('tenant')).toEqual([]);
  });

  it('keeps call options after the inserted metadata', async () => {
    const proxy = createProxy({});
    const method = createUnaryMethod();
    proxy.setOnDispatchHook((packet: any) => {
      packet.metadata = { tenant: 'acme' };
    });
    const options = { deadline: 1 };

    await lastValueFrom(
      proxy.createServiceMethod({ find: method }, 'find')({}, options),
    );

    const [data, metadata, callOptions] = argsBeforeCallback(method);
    expect(data).toEqual({});
    expect(metadata.get('tenant')).toEqual(['acme']);
    expect(callOptions).toBe(options);
  });
});

/**
 * getKeepaliveOptions() decisions:
 * D1 `!isObject(this.options.keepalive)` (T: {} returned, F: entries read).
 * D2 `key === undefined` (T: unknown key skipped, F: mapped and kept).
 */
describe('ClientGrpcProxy.getKeepaliveOptions', () => {
  it('returns nothing when keepalive is not an object', () => {
    expect(createProxy({ keepalive: undefined }).getKeepaliveOptions()).toEqual(
      {},
    );
    expect(createProxy({ keepalive: 'text' }).getKeepaliveOptions()).toEqual(
      {},
    );
    expect(createProxy({ keepalive: null }).getKeepaliveOptions()).toEqual({});
  });

  it('maps the known keys and skips the unknown ones', () => {
    const proxy = createProxy({
      keepalive: {
        keepaliveTimeMs: 1,
        http2MaxPingStrikes: 2,
        unknown: 3,
      },
    });

    expect(proxy.getKeepaliveOptions()).toEqual({
      'grpc.keepalive_time_ms': 1,
      'grpc.http2.max_ping_strikes': 2,
    });
  });
});

/**
 * close() decisions: `client && isFunction(client.close)` (T/T: closed,
 * T/F: skipped, F: skipped) followed by clearing both collections.
 */
describe('ClientGrpcProxy.close', () => {
  it('closes every closeable client and clears the collections', () => {
    const closeable = { close: vi.fn() };
    const notCloseable = { open: vi.fn() };
    const proxy = createProxy({});
    asAny(proxy).clients.set('a', closeable);
    asAny(proxy).clients.set('b', notCloseable);
    asAny(proxy).clients.set('c', null);
    asAny(proxy).grpcClients = [{ a: 1 }];

    proxy.close();

    expect(closeable.close).toHaveBeenCalledTimes(1);
    expect(asAny(proxy).clients.size).toBe(0);
    expect(asAny(proxy).grpcClients).toEqual([]);
  });
});

/** lookupPackage() decisions: `if (packageName)` (T/F), `if (!pkg) break` (T/F). */
describe('ClientGrpcProxy.lookupPackage', () => {
  it('returns the root without a package name', () => {
    const proxy = createProxy({});
    const root = {};

    expect(proxy.lookupPackage(root, undefined as any)).toBe(root);
    expect(proxy.lookupPackage(root, '')).toBe(root);
  });

  it('walks the namespace and stops when a segment is missing', () => {
    const proxy = createProxy({});
    const service = {};
    const root = { a: { b: { service } } };

    expect(proxy.lookupPackage(root, 'a.b.service')).toBe(service);
    expect(proxy.lookupPackage(root, 'a.missing.service')).toBeUndefined();
  });
});

/**
 * The methods gRPC does not support. None of them has a decision; each throws
 * so that a caller learns the transport is not usable that way.
 */
describe('ClientGrpcProxy unsupported methods', () => {
  it.each([
    ['connect', (proxy: any) => proxy.connect()],
    ['send', (proxy: any) => proxy.send('pattern', {})],
    ['publish', (proxy: any) => proxy.publish({}, () => undefined)],
    ['dispatchEvent', (proxy: any) => proxy.dispatchEvent({})],
    ['on', (proxy: any) => proxy.on('event', () => undefined)],
    ['unwrap', (proxy: any) => proxy.unwrap()],
  ])('rejects %s', async (_name, call) => {
    const proxy = createProxy({}) as any;

    await expect(async () => call(proxy)).rejects.toThrow(Error);
  });

  it('throws from the status getter', () => {
    const proxy = createProxy({});

    expect(() => proxy.status).toThrow(
      'The "status" attribute is not supported by the gRPC transport',
    );
  });
});
