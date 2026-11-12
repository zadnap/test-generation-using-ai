import { Metadata } from '@grpc/grpc-js';
import {
  EMPTY,
  NEVER,
  Subject,
  concat,
  lastValueFrom,
  of,
  toArray,
  throwError,
} from 'rxjs';
import { map } from 'rxjs/operators';
import { describe, expect, it, vi } from 'vitest';
import { GrpcMethodStreamingType } from '../../../../packages/microservices/decorators/message-pattern.decorator.js';
import { GrpcStatus } from '../../../../packages/microservices/enums/grpc-status.enum.js';
import { InvalidGrpcPackageException } from '../../../../packages/microservices/errors/invalid-grpc-package.exception.js';
import { InvalidProtoDefinitionException } from '../../../../packages/microservices/errors/invalid-proto-definition.exception.js';
import { ServerGrpc } from '../../../../packages/microservices/server/server-grpc.js';

const CANCELLED_EVENT = 'cancelled';

const asAny = (value: unknown) => value as any;

const tick = () => new Promise(resolve => setImmediate(resolve));

const defaultOptions = () => ({ package: 'test', protoPath: 'test.proto' });

const createServer = (options: any = defaultOptions()) =>
  new ServerGrpc(options) as ServerGrpc;

const silenceLogger = (server: ServerGrpc) =>
  vi.spyOn(asAny(server).logger, 'error').mockImplementation(() => {});

const internalError = {
  code: GrpcStatus.INTERNAL,
  details: 'Internal server error',
};

/**
 * Installs a fake @grpc/grpc-js package into the module-level slot the class
 * reads, through the class's own `loadPackage` collaborator. No channel,
 * socket or listener is ever created.
 */
const installGrpcPackage = async (server: ServerGrpc, pkg: any) => {
  vi.spyOn(asAny(server), 'loadPackage').mockResolvedValue(pkg);
  await asAny(server).loadGrpcPackage();
  return pkg;
};

const createFakeGrpcPackage = () => {
  const instances: any[] = [];
  const insecure = { insecure: true };
  class FakeGrpcServer {
    public bindAsync = vi.fn(
      (_url: string, _credentials: any, callback: Function) =>
        callback(null, 5000),
    );
    constructor(public options: any) {
      instances.push(this);
    }
  }
  return {
    instances,
    insecure,
    pkg: {
      Server: FakeGrpcServer,
      ServerCredentials: { createInsecure: vi.fn(() => insecure) },
      loadPackageDefinition: vi.fn(() => ({ loaded: 'definition' })),
    },
  };
};

const createCall = (overrides: Record<string, any> = {}) => {
  const listeners: Record<string, Function[]> = {};
  const call: any = {
    request: { id: 1 },
    metadata: new Metadata(),
    cancelled: false,
    write: vi.fn(() => true),
    end: vi.fn(),
    sendMetadata: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    listeners,
    on: vi.fn((event: string, callback: Function) => {
      (listeners[event] ??= []).push(callback);
      return call;
    }),
    off: vi.fn((event: string, callback: Function) => {
      listeners[event] = (listeners[event] ?? []).filter(cb => cb !== callback);
      return call;
    }),
    // Unlike an EventEmitter, an unhandled "error" is not thrown
    emit: vi.fn((event: string, ...args: unknown[]) => {
      (listeners[event] ?? []).slice().forEach(cb => cb(...args));
    }),
    ...overrides,
  };
  return call;
};

const noResponseError = {
  code: GrpcStatus.INTERNAL,
  details: 'The handler completed without emitting a response',
};

/**
 * Constructor decisions:
 * D1 `getOptionsProp(options, 'url') || GRPC_DEFAULT_URL` (T: url given,
 *    F: default url).
 * D2 `getOptionsProp(options, 'protoLoader') || GRPC_DEFAULT_PROTO_LOADER`
 *    (T: custom loader, F: default). Both resolve to the installed
 *    @grpc/proto-loader; nothing is loaded from disk here.
 * The limits/channel options are read by createClient(), graceful shutdown by
 * close(); neither is a constructor default.
 */
describe('ServerGrpc constructor', () => {
  it('keeps the given url', () => {
    const server = createServer({ ...defaultOptions(), url: 'grpc:1' });

    expect(asAny(server).url).toBe('grpc:1');
  });

  it('defaults the url', () => {
    const server = createServer();

    expect(asAny(server).url).toBe('localhost:5000');
  });

  it('accepts a custom proto loader', () => {
    const server = createServer({
      ...defaultOptions(),
      protoLoader: '@grpc/proto-loader',
    });

    expect(asAny(server).transportId).toBeDefined();
  });

  it('uses the default proto loader', () => {
    expect(() => createServer()).not.toThrow();
  });
});

/** The status getter has no decision: it always throws. */
describe('ServerGrpc status', () => {
  it('throws', () => {
    const server = createServer();

    expect(() => server.status).toThrow(
      'The "status" attribute is not supported by the gRPC transport',
    );
  });
});

/**
 * listen() decisions: try/catch (T: the client is created and the server
 * starts, F: either step rejects and the callback receives the error).
 */
describe('ServerGrpc.listen', () => {
  it('creates the client, starts and calls the callback', async () => {
    const server = createServer();
    const callback = vi.fn();
    const created = { fake: 'server' };
    vi.spyOn(server, 'createClient').mockResolvedValue(created);
    vi.spyOn(server, 'start').mockImplementation(async () => {
      callback();
    });

    await server.listen(callback);

    expect(asAny(server).grpcClient).toBe(created);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('passes a client creation failure to the callback', async () => {
    const server = createServer();
    const callback = vi.fn();
    const error = new Error('cannot bind');
    vi.spyOn(server, 'createClient').mockRejectedValue(error);
    const start = vi.spyOn(server, 'start');

    await server.listen(callback);

    expect(callback).toHaveBeenCalledWith(error);
    expect(start).not.toHaveBeenCalled();
  });
});

/** start() decisions: `callback?.()` (T: called, F: absent). */
describe('ServerGrpc.start', () => {
  it('binds the events and calls the callback', async () => {
    const server = createServer();
    const bindEvents = vi
      .spyOn(server, 'bindEvents')
      .mockResolvedValue(undefined);
    const callback = vi.fn();

    await server.start(callback);

    expect(bindEvents).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('works without a callback', async () => {
    const server = createServer();
    vi.spyOn(server, 'bindEvents').mockResolvedValue(undefined);

    await expect(server.start()).resolves.toBeUndefined();
  });
});

/**
 * bindEvents() decisions:
 * D1 `Array.isArray(packageOption)` (T: several packages, F: one).
 * D2 `if (!grpcPkg)` (T: InvalidGrpcPackageException, F: services registered).
 */
describe('ServerGrpc.bindEvents', () => {
  it('registers the services of a single package', async () => {
    const server = createServer();
    await installGrpcPackage(server, createFakeGrpcPackage().pkg);
    vi.spyOn(server, 'loadProto').mockReturnValue({
      test: { Svc: { format: 'grpc', service: { definition: 'test' } } },
    });
    asAny(server).grpcClient = { addService: vi.fn() };

    await server.bindEvents();

    expect(asAny(server).grpcClient.addService).toHaveBeenCalledExactlyOnceWith(
      { definition: 'test' },
      {},
    );
  });

  it('registers the services of every package of an array', async () => {
    const server = createServer({ package: ['test', 'test2'], protoPath: 'x' });
    await installGrpcPackage(server, createFakeGrpcPackage().pkg);
    vi.spyOn(server, 'loadProto').mockReturnValue({
      test: { Svc: { format: 'grpc', service: { definition: 'test' } } },
      test2: { Svc2: { format: 'grpc', service: { definition: 'test2' } } },
    });
    asAny(server).grpcClient = { addService: vi.fn() };

    await server.bindEvents();

    expect(asAny(server).grpcClient.addService).toHaveBeenCalledTimes(2);
  });

  it('throws InvalidGrpcPackageException when a package is missing', async () => {
    const server = createServer({ package: 'missing', protoPath: 'x' });
    const loggerError = silenceLogger(server);
    await installGrpcPackage(server, createFakeGrpcPackage().pkg);
    vi.spyOn(server, 'loadProto').mockReturnValue({});
    asAny(server).grpcClient = { addService: vi.fn() };

    await expect(server.bindEvents()).rejects.toBeInstanceOf(
      InvalidGrpcPackageException,
    );
    expect(loggerError).toHaveBeenCalledWith(
      expect.any(InvalidGrpcPackageException),
    );
  });
});

/**
 * getServiceNames()/collectDeepServices()/parseDeepServiceName() decisions:
 * D1 `if (!isObject(grpcDefinition))` (T: stop, F: traverse).
 * D2 `isServiceDefined = deepDefinition && !isUndefined(deepDefinition.service)`
 *    (T/F for both `deepDefinition` and `service`).
 * D3 `isServiceBoolean = service !== false` (T: collected, F: skipped).
 * D4 `isFormatDefined` (T: a format entry ends the traversal, F: recurse).
 * D5 `name.length === 0` in parseDeepServiceName (T: first level, F: nested).
 */
describe('ServerGrpc.getServiceNames', () => {
  it('collects every service under its fully qualified name', () => {
    const server = createServer();
    const serviceDefinition = { serviceName: {} };
    const grpcPkg = {
      A: {
        C: { E: { service: serviceDefinition } },
        Formatted: { format: 'grpc' },
        NotAService: { service: false },
        UndefinedService: { service: undefined },
        leaf: 'text',
        missing: undefined,
      },
      B: { D: { service: serviceDefinition } },
    };

    expect(server.getServiceNames(grpcPkg)).toEqual([
      { name: 'A.C.E', service: { service: serviceDefinition } },
      { name: 'B.D', service: { service: serviceDefinition } },
    ]);
  });

  it('returns nothing for a non-object definition', () => {
    const server = createServer();

    expect(server.getServiceNames(null)).toEqual([]);
  });
});

/**
 * getKeepaliveOptions() decisions: `!isObject(keepalive)` (T: {}, F: read)
 * and `key === undefined` (T: skipped, F: mapped).
 */
describe('ServerGrpc.getKeepaliveOptions', () => {
  it('returns nothing when keepalive is not an object', () => {
    expect(
      createServer({
        ...defaultOptions(),
        keepalive: 'text',
      }).getKeepaliveOptions(),
    ).toEqual({});
    expect(createServer().getKeepaliveOptions()).toEqual({});
  });

  it('maps the known keys and skips the unknown ones', () => {
    const server = createServer({
      ...defaultOptions(),
      keepalive: {
        keepaliveTimeoutMs: 1,
        http2MaxPingsWithoutData: 2,
        nope: 3,
      },
    });

    expect(server.getKeepaliveOptions()).toEqual({
      'grpc.keepalive_timeout_ms': 1,
      'grpc.http2.max_pings_without_data': 2,
    });
  });
});

/**
 * createService() decisions:
 * D1 `!isUndefined(methodReqStreaming) && methodReqStreaming`
 *    (T: streaming, F: not streaming - both for `false` and for `undefined`).
 * D2 `if (!methodHandler)` after the RX attempt (T: try PT, F: RX found).
 * D3 `if (!methodHandler)` after the pattern selection (T: method skipped,
 *    F: registered).
 */
describe('ServerGrpc.createService', () => {
  const registerHandler = (
    server: ServerGrpc,
    service: string,
    method: string,
    streaming: GrpcMethodStreamingType,
  ) => {
    const handler = vi.fn();
    asAny(server).messageHandlers.set(
      server.createPattern(service, method, streaming),
      handler,
    );
    return handler;
  };

  it('registers a RX streaming handler', async () => {
    const server = createServer();
    const handler = registerHandler(
      server,
      'Svc',
      'watch',
      GrpcMethodStreamingType.RX_STREAMING,
    );
    const createServiceMethod = vi
      .spyOn(server, 'createServiceMethod')
      .mockReturnValue(vi.fn() as any);

    const service = await server.createService(
      { prototype: { watch: { requestStream: true } } },
      'Svc',
    );

    expect(Object.keys(service)).toEqual(['watch']);
    expect(handler.name).toBe('watch');
    expect(createServiceMethod).toHaveBeenCalledWith(
      handler,
      { requestStream: true },
      GrpcMethodStreamingType.RX_STREAMING,
    );
  });

  it('falls back to a PT streaming handler', async () => {
    const server = createServer();
    const handler = registerHandler(
      server,
      'Svc',
      'watch',
      GrpcMethodStreamingType.PT_STREAMING,
    );
    const createServiceMethod = vi
      .spyOn(server, 'createServiceMethod')
      .mockReturnValue(vi.fn() as any);

    await server.createService(
      { prototype: { watch: { requestStream: true } } },
      'Svc',
    );

    expect(createServiceMethod).toHaveBeenCalledWith(
      handler,
      { requestStream: true },
      GrpcMethodStreamingType.PT_STREAMING,
    );
  });

  it('registers a non streaming handler for a method without requestStream', async () => {
    const server = createServer();
    const handler = registerHandler(
      server,
      'Svc',
      'find',
      GrpcMethodStreamingType.NO_STREAMING,
    );
    const createServiceMethod = vi
      .spyOn(server, 'createServiceMethod')
      .mockReturnValue(vi.fn() as any);

    await server.createService(
      { prototype: { find: { requestStream: undefined } } },
      'Svc',
    );
    await server.createService(
      { prototype: { find: { requestStream: false } } },
      'Svc',
    );

    expect(createServiceMethod).toHaveBeenCalledTimes(2);
    expect(createServiceMethod.mock.calls[0][2]).toBe(
      GrpcMethodStreamingType.NO_STREAMING,
    );
    expect(createServiceMethod.mock.calls[0][0]).toBe(handler);
  });

  it('skips a method without a handler', async () => {
    const server = createServer();
    const createServiceMethod = vi.spyOn(server, 'createServiceMethod');

    const service = await server.createService(
      { prototype: { find: { requestStream: false } } },
      'Svc',
    );

    expect(service).toEqual({});
    expect(createServiceMethod).not.toHaveBeenCalled();
  });
});

/**
 * getMessageHandler() decisions:
 * D1 `if (!methodHandler)` (T: retry with the package-qualified service name,
 *    F: found by service name).
 * D2 `grpcMethod.path?.split?.(...)` (T: path with a package, F: no path).
 */
describe('ServerGrpc.getMessageHandler', () => {
  const addHandlerFor = (
    server: ServerGrpc,
    service: string,
    rpc: string,
    streaming = GrpcMethodStreamingType.NO_STREAMING,
  ) => {
    const handler = vi.fn();
    asAny(server).messageHandlers.set(
      server.createPattern(service, rpc, streaming),
      handler,
    );
    return handler;
  };

  it('finds the handler by service name', () => {
    const server = createServer();
    const handler = addHandlerFor(server, 'Svc', 'find');

    expect(
      server.getMessageHandler(
        'Svc',
        'find',
        GrpcMethodStreamingType.NO_STREAMING,
        {},
      ),
    ).toBe(handler);
  });

  it('retries with the package qualified name from the method path', () => {
    const server = createServer();
    const handler = addHandlerFor(server, 'pkg.Svc', 'find');

    expect(
      server.getMessageHandler(
        'Svc',
        'find',
        GrpcMethodStreamingType.NO_STREAMING,
        {
          path: '/pkg.Svc/find',
        },
      ),
    ).toBe(handler);
  });

  it('returns undefined without a path and without a handler', () => {
    const server = createServer();

    expect(
      server.getMessageHandler(
        'Svc',
        'find',
        GrpcMethodStreamingType.NO_STREAMING,
        {},
      ),
    ).toBeUndefined();
  });

  it('returns undefined for a path that cannot be split', () => {
    const server = createServer();

    expect(
      server.getMessageHandler(
        'Svc',
        'find',
        GrpcMethodStreamingType.NO_STREAMING,
        {
          path: {} as any,
        },
      ),
    ).toBeUndefined();
  });
});

/** createPattern() has no decision: the pattern is a JSON object. */
describe('ServerGrpc.createPattern', () => {
  it('serializes the service, rpc and streaming type', () => {
    const server = createServer();

    expect(
      server.createPattern('Svc', 'find', GrpcMethodStreamingType.NO_STREAMING),
    ).toBe(
      JSON.stringify({
        service: 'Svc',
        rpc: 'find',
        streaming: GrpcMethodStreamingType.NO_STREAMING,
      }),
    );
  });
});

/**
 * createServiceMethod() decisions:
 * D1 `protoNativeHandler.requestStream` (T/F).
 * D2 `streamType === RX_STREAMING` (T/F).
 * D3 `streamType === PT_STREAMING` (T/F).
 * D4 `protoNativeHandler.responseStream` (T: stream service method,
 *    F: unary service method).
 */
describe('ServerGrpc.createServiceMethod', () => {
  const handler = () => ({});
  const spyOnCreators = (server: ServerGrpc) => ({
    request: vi
      .spyOn(server, 'createRequestStreamMethod')
      .mockReturnValue(vi.fn() as any),
    call: vi
      .spyOn(server, 'createStreamCallMethod')
      .mockReturnValue(vi.fn() as any),
    stream: vi
      .spyOn(server, 'createStreamServiceMethod')
      .mockReturnValue(vi.fn() as any),
    unary: vi
      .spyOn(server, 'createUnaryServiceMethod')
      .mockReturnValue(vi.fn() as any),
  });

  it('creates a request stream method for RX streaming', () => {
    const server = createServer();
    const spies = spyOnCreators(server);

    server.createServiceMethod(
      handler,
      { requestStream: true, responseStream: true },
      GrpcMethodStreamingType.RX_STREAMING,
    );

    expect(spies.request).toHaveBeenCalledWith(handler, true);
    expect(spies.call).not.toHaveBeenCalled();
  });

  it('creates a stream call method for PT streaming', () => {
    const server = createServer();
    const spies = spyOnCreators(server);

    server.createServiceMethod(
      handler,
      { requestStream: true, responseStream: false },
      GrpcMethodStreamingType.PT_STREAMING,
    );

    expect(spies.call).toHaveBeenCalledWith(handler, false);
    expect(spies.request).not.toHaveBeenCalled();
  });

  it('falls through to the response stream method for an unknown streaming type', () => {
    const server = createServer();
    const spies = spyOnCreators(server);

    server.createServiceMethod(
      handler,
      { requestStream: true, responseStream: true },
      GrpcMethodStreamingType.NO_STREAMING,
    );

    expect(spies.stream).toHaveBeenCalledWith(handler);
    expect(spies.request).not.toHaveBeenCalled();
    expect(spies.call).not.toHaveBeenCalled();
  });

  it('creates a unary method when neither side streams', () => {
    const server = createServer();
    const spies = spyOnCreators(server);

    server.createServiceMethod(
      handler,
      { requestStream: false, responseStream: false },
      GrpcMethodStreamingType.NO_STREAMING,
    );

    expect(spies.unary).toHaveBeenCalledWith(handler);
    expect(spies.stream).not.toHaveBeenCalled();
  });
});

/**
 * createUnaryServiceMethod() decisions:
 * D1 try/catch around the handler (T: answered, F: the handler throws/rejects
 *    and the call is failed with an internal error).
 * D2 `if (call.cancelled)` (T: no subscription, F: subscribe).
 * D3 `if (error)` in the response callback (T: error forwarded, F: value).
 * D4 `Promise.resolve(data).then(ok, error)` (T: response resolves,
 *    F: response promise rejects).
 * D5 the response stream erroring (T) versus completing (F).
 */
describe('ServerGrpc.createUnaryServiceMethod', () => {
  it('answers with the handler result', async () => {
    const server = createServer();
    const call = createCall();
    const callback = vi.fn();

    await server.createUnaryServiceMethod(async () => 'response')(
      call as any,
      callback,
    );
    await tick();

    expect(callback).toHaveBeenCalledExactlyOnceWith(null, 'response');
  });

  it('answers with the first value of a response stream', async () => {
    const server = createServer();
    const callback = vi.fn();

    await server.createUnaryServiceMethod(() => of('only'))(
      createCall() as any,
      callback,
    );
    await tick();

    expect(callback).toHaveBeenCalledWith(null, 'only');
  });

  it('fails the call when the handler completes without a response', async () => {
    const server = createServer();
    const callback = vi.fn();

    await server.createUnaryServiceMethod(() => EMPTY)(
      createCall() as any,
      callback,
    );

    expect(callback).toHaveBeenCalledExactlyOnceWith(noResponseError);
  });

  it('fails the call when the handler throws', async () => {
    const server = createServer();
    const loggerError = silenceLogger(server);
    const callback = vi.fn();
    const error = new Error('handler threw');

    await server.createUnaryServiceMethod(() => {
      throw error;
    })(createCall() as any, callback);

    expect(callback).toHaveBeenCalledExactlyOnceWith(internalError);
    expect(loggerError).toHaveBeenCalledWith(error);
  });

  it('fails the call when the response promise rejects', async () => {
    const server = createServer();
    silenceLogger(server);
    const callback = vi.fn();

    await server.createUnaryServiceMethod(() =>
      of('hero').pipe(
        // An interceptor mapping to an async function
        map(async () => {
          throw new Error('async failure');
        }),
      ),
    )(createCall() as any, callback);
    await tick();

    expect(callback).toHaveBeenCalledExactlyOnceWith(internalError);
  });

  it('fails the call with the response stream error', async () => {
    const server = createServer();
    const callback = vi.fn();
    const error = { code: GrpcStatus.NOT_FOUND, details: 'missing' };

    await server.createUnaryServiceMethod(() => throwError(() => error))(
      createCall() as any,
      callback,
    );

    expect(callback).toHaveBeenCalledExactlyOnceWith(error);
  });

  it('does not subscribe to the response when the call is already cancelled', async () => {
    const server = createServer();
    const response$ = new Subject<string>();
    const callback = vi.fn();

    await server.createUnaryServiceMethod(() => response$)(
      createCall({ cancelled: true }) as any,
      callback,
    );

    expect(response$.observed).toBe(false);
    expect(callback).not.toHaveBeenCalled();
  });

  it('unsubscribes from the response stream when the call is cancelled', async () => {
    const server = createServer();
    const response$ = new Subject<string>();
    const callback = vi.fn();
    const call = createCall();

    await server.createUnaryServiceMethod(() => response$)(
      call as any,
      callback,
    );
    expect(response$.observed).toBe(true);
    call.emit(CANCELLED_EVENT, 'cancelled');

    expect(response$.observed).toBe(false);
  });
});

/**
 * The error sanitizer the class sends errors through. Decisions:
 * D1 `!isObject(err) && !isFunction(err)` (T: a string becomes an UNKNOWN
 *    error, F: the object is inspected).
 * D2 `toWellFormed(message) === message && toWellFormed(details) === details`
 *    (T: the error is sent as it is, F: a copy with well formed text).
 * D3 `isString(text)` in toWellFormed (T: replaced, F: left alone).
 */
describe('ServerGrpc error sendability', () => {
  it('wraps an error that is not an object', async () => {
    const server = createServer();
    const callback = vi.fn();

    await server.createUnaryServiceMethod(() =>
      throwError(() => 'Forbidden resource'),
    )(createCall() as any, callback);

    expect(callback).toHaveBeenCalledExactlyOnceWith({
      code: GrpcStatus.UNKNOWN,
      message: 'Forbidden resource',
    });
  });

  it('replaces a lone surrogate in the status text', async () => {
    const server = createServer();
    const callback = vi.fn();
    const error = {
      code: GrpcStatus.INVALID_ARGUMENT,
      message: `Unexpected token '\ud83d'`,
    };

    await server.createUnaryServiceMethod(() => throwError(() => error))(
      createCall() as any,
      callback,
    );

    expect(callback).toHaveBeenCalledExactlyOnceWith({
      code: GrpcStatus.INVALID_ARGUMENT,
      message: `Unexpected token '\ufffd'`,
      details: undefined,
      metadata: undefined,
    });
  });

  it('sends a well formed error as it is', async () => {
    const server = createServer();
    const callback = vi.fn();
    const error = new Error('well formed');

    await server.createUnaryServiceMethod(() => throwError(() => error))(
      createCall() as any,
      callback,
    );

    expect(callback.mock.calls[0][0]).toBe(error);
  });
});

/**
 * createStreamServiceMethod() decisions:
 * D1 try/catch around the handler (T: values written, F: the call is failed
 *    with an internal error).
 * D2 `call.cancelled` at the start of the write (T: nothing written,
 *    F: values written and end() called).
 * D3 the response stream erroring (T) versus completing (F).
 */
describe('ServerGrpc.createStreamServiceMethod', () => {
  it('writes the response and ends the call', async () => {
    const server = createServer();
    const call = createCall();

    await server.createStreamServiceMethod(() => of('a', 'b'))(
      call as any,
      vi.fn(),
    );

    expect(call.write.mock.calls).toEqual([['a'], ['b']]);
    expect(call.end).toHaveBeenCalledTimes(1);
    expect(call.emit).not.toHaveBeenCalled();
  });

  it('fails the call with an internal error when the handler throws', async () => {
    const server = createServer();
    const loggerError = silenceLogger(server);
    const error = new Error('handler threw');
    const call = createCall();

    await server.createStreamServiceMethod(() => {
      throw error;
    })(call as any, vi.fn());

    expect(call.emit).toHaveBeenCalledExactlyOnceWith('error', internalError);
    expect(loggerError).toHaveBeenCalledWith(error);
  });

  it('fails the call after writing the values before an error', async () => {
    const server = createServer();
    const call = createCall();
    const error = { code: GrpcStatus.ABORTED, details: 'aborted' };

    await server.createStreamServiceMethod(() =>
      concat(
        of('a'),
        throwError(() => error),
      ),
    )(call as any, vi.fn());

    expect(call.write.mock.calls).toEqual([['a']]);
    expect(call.emit).toHaveBeenCalledExactlyOnceWith('error', error);
  });

  it('writes nothing when the call is already cancelled', async () => {
    const server = createServer();
    const call = createCall({ cancelled: true });

    await server.createStreamServiceMethod(() => of('a'))(call as any, vi.fn());

    expect(call.write).not.toHaveBeenCalled();
    expect(call.end).not.toHaveBeenCalled();
  });
});

/**
 * The private response writer behind createStreamServiceMethod() and
 * createRequestStreamMethod(). Decisions:
 * D1 `call.cancelled` at the start (T: nothing written, F: written).
 * D2 `value instanceof PendingResponse` (T: a promise waits, F: written).
 * D3 `if (!settled)` (T: stop at the pending promise, F: continue).
 * D4 `'error' in settled` (T: the response fails, F: the value is written).
 * D5 `value === null` for a resolved promise (T: fails, F: written).
 * D6 `nextIndex === length` / `nextIndex > length / 2` (T: queue emptied,
 *    T: spliced, F: kept).
 * D7 `if (responseError)` (T: emitted, F: none).
 * D8 `if (!writing)` (T: waits for "drain", F: keeps writing) and
 *    `!requestsPaused && call.pause` (T: paused, F: already paused).
 * D9 the resume condition `requestsPaused && waiting < highWaterMark`
 *    (T: resumed, F: not).
 * D10 `if (valuesWaitingToBeDrained.length > 0)` (T: still waiting, F: done).
 * D11 `shouldResolveAfterDraining` (T: resolved after the drain, F: not).
 * D12 `shouldErrorAfterDraining` (T: failed after the drain, F: not).
 * D13 `if (subscription.closed)` (T: a late settlement is ignored, F: written).
 * D14 the source erroring/completing with values still waiting (both
 *    outcomes for each).
 */
describe('ServerGrpc response writing', () => {
  const deferred = () => {
    let resolve: (value: unknown) => void = () => undefined;
    let reject: (error: unknown) => void = () => undefined;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };

  const start = (server: ServerGrpc, subject: Subject<unknown>, call: any) => {
    const result = server.createStreamServiceMethod(() => subject)(
      call as any,
      vi.fn(),
    );
    return result;
  };

  it('writes promise values in emission order once they settle', async () => {
    const server = createServer();
    const call = createCall();
    const subject = new Subject<unknown>();
    const slow = deferred();
    const result = start(server, subject, call);
    await tick();

    subject.next(slow.promise);
    subject.next({ n: 2 });
    subject.complete();
    expect(call.write).not.toHaveBeenCalled();

    slow.resolve({ n: 1 });
    await result;

    expect(call.write.mock.calls).toEqual([[{ n: 1 }], [{ n: 2 }]]);
    expect(call.end).toHaveBeenCalledTimes(1);
  });

  it('stops at a promise that has not settled yet', async () => {
    const server = createServer();
    const call = createCall();
    const subject = new Subject<unknown>();
    const first = deferred();
    const second = deferred();
    const result = start(server, subject, call);
    await tick();

    subject.next(first.promise);
    subject.next(second.promise);
    subject.complete();
    second.resolve('second');
    await tick();
    expect(call.write).not.toHaveBeenCalled();

    first.resolve('first');
    await result;

    expect(call.write.mock.calls).toEqual([['first'], ['second']]);
  });

  it('fails the call when a response promise rejects', async () => {
    const server = createServer();
    silenceLogger(server);
    const call = createCall();
    const slow = deferred();

    const result = server.createStreamServiceMethod(() => of(slow.promise))(
      call as any,
      vi.fn(),
    );
    await tick();
    slow.reject(new Error('enrich failed'));
    await result;

    expect(call.write).not.toHaveBeenCalled();
    expect(call.emit).toHaveBeenCalledExactlyOnceWith('error', internalError);
  });

  it('fails the call instead of writing null', async () => {
    const server = createServer();
    const call = createCall();

    await server.createStreamServiceMethod(() => of('a', null))(
      call as any,
      vi.fn(),
    );

    expect(call.write.mock.calls).toEqual([['a']]);
    expect(call.emit).toHaveBeenCalledExactlyOnceWith('error', {
      code: GrpcStatus.INTERNAL,
      details: 'The handler emitted a null response',
    });
  });

  it('fails the call when a response promise resolves to null', async () => {
    const server = createServer();
    const call = createCall();

    await server.createStreamServiceMethod(() => of(Promise.resolve(null)))(
      call as any,
      vi.fn(),
    );

    expect(call.write).not.toHaveBeenCalled();
    expect(call.emit).toHaveBeenCalledExactlyOnceWith('error', {
      code: GrpcStatus.INTERNAL,
      details: 'The handler emitted a null response',
    });
  });

  it('pauses the requests while the call is full and resumes them on drain', async () => {
    const server = createServer();
    const call = createCall({ writableHighWaterMark: 1 });
    call.write = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
    const subject = new Subject<unknown>();
    const result = start(server, subject, call);
    await tick();

    subject.next('a');
    expect(call.pause).toHaveBeenCalledTimes(1);
    subject.next('b');
    expect(call.pause).toHaveBeenCalledTimes(1);

    call.emit('drain');
    expect(call.write.mock.calls).toEqual([['a'], ['b']]);
    expect(call.resume).toHaveBeenCalledTimes(1);

    subject.complete();
    await result;

    expect(call.end).toHaveBeenCalled();
  });

  it('pauses the requests when as many responses wait as the call buffers', async () => {
    const server = createServer();
    const call = createCall({ writableHighWaterMark: 2 });
    const subject = new Subject<unknown>();
    const first = deferred();
    const second = deferred();
    const result = start(server, subject, call);
    await tick();

    subject.next(first.promise);
    expect(call.pause).not.toHaveBeenCalled();
    subject.next(second.promise);
    expect(call.pause).toHaveBeenCalledTimes(1);

    first.resolve('first');
    second.resolve('second');
    subject.complete();
    await result;

    expect(call.write.mock.calls).toEqual([['first'], ['second']]);
    expect(call.resume).toHaveBeenCalled();
  });

  it('fails the call once the values before an error are written', async () => {
    const server = createServer();
    const call = createCall();
    call.write = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
    const subject = new Subject<unknown>();
    const error = { code: GrpcStatus.ABORTED, details: 'aborted' };
    const result = start(server, subject, call);
    await tick();

    subject.next('a');
    subject.next('b');
    subject.error(error);
    expect(call.emit).not.toHaveBeenCalled();

    call.emit('drain');
    await result;

    expect(call.write.mock.calls).toEqual([['a'], ['b']]);
    expect(call.emit).toHaveBeenCalledWith('error', error);
  });

  it('releases the written values of a queue that does not empty', async () => {
    const server = createServer();
    const call = createCall();
    call.write = vi
      .fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)
      .mockReturnValue(true);
    const subject = new Subject<unknown>();
    const result = start(server, subject, call);
    await tick();

    for (const value of ['a', 'b', 'c', 'd', 'e']) {
      subject.next(value);
    }
    expect(call.write.mock.calls).toEqual([['a']]);

    call.emit('drain');
    expect(call.write.mock.calls).toEqual([['a'], ['b'], ['c'], ['d']]);
    subject.next('f');
    call.emit('drain');
    subject.complete();
    await result;

    expect(call.write.mock.calls.map(([value]: unknown[]) => value)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
    ]);
    expect(call.end).toHaveBeenCalled();
  });

  it('ignores a promise that settles after the client cancelled', async () => {
    const server = createServer();
    const call = createCall();
    const slow = deferred();
    const subject = new Subject<unknown>();
    const result = start(server, subject, call);
    await tick();

    subject.next(slow.promise);
    call.emit(CANCELLED_EVENT);
    await expect(result).resolves.toBeUndefined();

    slow.resolve('late');
    await tick();

    expect(call.write).not.toHaveBeenCalled();
  });
});

/**
 * createRequestStreamMethod() decisions:
 * D1 `isResponseStream` (T: values written to the call, F: a single reply
 *    through the callback).
 * D2 `callsEmittingResponseError.has(call)` in the request error listener
 *    (T: the response error is not forwarded to the request stream, F: it is).
 * D3 `String(e).toLowerCase().indexOf('cancelled') !== -1` (T: the request
 *    stream is completed and the call ended, F: the error is passed on).
 * D4 `if (!errored && !call.cancelled)` (T: replied, F: not replied - for
 *    `errored` alone and for `call.cancelled` alone).
 */
describe('ServerGrpc.createRequestStreamMethod', () => {
  const consume = (stream: any) => {
    stream.drainBuffer?.();
    return lastValueFrom(stream.pipe(toArray()));
  };

  it('replies with the handler result', async () => {
    const server = createServer();
    const call = createCall();
    const callback = vi.fn();

    const result = server.createRequestStreamMethod(
      async () => ({ test: true }),
      false,
    )(call as any, callback);
    call.emit('end');
    await result;

    expect(callback).toHaveBeenCalledExactlyOnceWith(null, { test: true });
  });

  it('replies with undefined for a handler without a result', async () => {
    const server = createServer();
    const call = createCall();
    const callback = vi.fn();

    const result = server.createRequestStreamMethod(
      async () => undefined,
      false,
    )(call as any, callback);
    call.emit('end');
    await result;

    expect(callback).toHaveBeenCalledExactlyOnceWith(null, undefined);
  });

  it('replies with an error when the handler completes without a response', async () => {
    const server = createServer();
    const call = createCall();
    const callback = vi.fn();

    const result = server.createRequestStreamMethod(() => EMPTY, false)(
      call as any,
      callback,
    );
    call.emit('end');
    await result;

    expect(callback).toHaveBeenCalledExactlyOnceWith(noResponseError, null);
  });

  it('replies with the response stream error', async () => {
    const server = createServer();
    const call = createCall();
    const callback = vi.fn();
    const error = { code: GrpcStatus.INVALID_ARGUMENT, details: 'bad' };

    const result = server.createRequestStreamMethod(
      () => throwError(() => error),
      false,
    )(call as any, callback);
    call.emit('end');
    await result;

    expect(callback).toHaveBeenCalledExactlyOnceWith(error, null);
  });

  it('replies with an internal error when the handler throws', async () => {
    const server = createServer();
    silenceLogger(server);
    const call = createCall();
    const callback = vi.fn();

    const result = server.createRequestStreamMethod(async () => {
      throw new Error('boom');
    }, false)(call as any, callback);
    call.emit('end');
    await result;

    expect(callback).toHaveBeenCalledExactlyOnceWith(internalError, null);
  });

  it('does not reply when the client cancelled before the reply', async () => {
    const server = createServer();
    const call = createCall();
    const callback = vi.fn();

    const result = server.createRequestStreamMethod(async () => {
      call.cancelled = true;
      return 'response';
    }, false)(call as any, callback);
    call.emit('end');
    await result;

    expect(callback).not.toHaveBeenCalled();
  });

  it('writes the response stream of a streaming call', async () => {
    const server = createServer();
    const call = createCall();
    const handler = (stream: any) => {
      stream.drainBuffer?.();
      return of('a', 'b');
    };

    const result = server.createRequestStreamMethod(handler, true)(
      call as any,
      vi.fn(),
    );
    call.emit('end');
    await result;

    expect(call.write.mock.calls).toEqual([['a'], ['b']]);
    expect(call.end).toHaveBeenCalled();
  });

  it('does not forward the response error to the request stream', async () => {
    const server = createServer();
    silenceLogger(server);
    const call = createCall();
    const requestErrors: unknown[] = [];
    const handler = (stream: any) => {
      stream.subscribe({ error: (err: unknown) => requestErrors.push(err) });
      stream.drainBuffer?.();
      throw new Error('response failed');
    };

    const result = server.createRequestStreamMethod(handler, true)(
      call as any,
      vi.fn(),
    );
    call.emit('end');
    await result;

    expect(call.emit.mock.calls[0]).toEqual(['error', internalError]);
    expect(requestErrors).toEqual([]);
  });

  it('completes the request stream and ends the call on a cancellation error', async () => {
    const server = createServer();
    const call = createCall();
    const requestErrors: unknown[] = [];
    const handler = (stream: any) => {
      stream.subscribe({ error: (err: unknown) => requestErrors.push(err) });
      stream.drainBuffer?.();
      return NEVER;
    };

    const result = server.createRequestStreamMethod(handler, true)(
      call as any,
      vi.fn(),
    );
    await tick();
    call.emit('error', new Error('cancelled'));

    expect(call.end).toHaveBeenCalledTimes(1);
    expect(requestErrors).toEqual([]);

    call.emit(CANCELLED_EVENT);
    await result;
  });

  it('passes a transport error on to the request stream', async () => {
    const server = createServer();
    const call = createCall();
    const requestErrors: unknown[] = [];
    const transportError = new Error('transport failed');
    const handler = (stream: any) => {
      stream.subscribe({ error: (err: unknown) => requestErrors.push(err) });
      stream.drainBuffer?.();
      return NEVER;
    };

    const result = server.createRequestStreamMethod(handler, true)(
      call as any,
      vi.fn(),
    );
    await tick();
    call.emit('error', transportError);

    expect(requestErrors).toEqual([transportError]);

    call.emit(CANCELLED_EVENT);
    await result;
  });

  it('completes the request stream on the cancelled event', async () => {
    const server = createServer();
    const call = createCall();
    const handler = () => NEVER;

    const result = server.createRequestStreamMethod(handler, true)(
      call as any,
      vi.fn(),
    );
    await tick();
    call.emit(CANCELLED_EVENT, 'cancelled');

    await expect(result).resolves.toBeUndefined();
  });

  it('delivers the buffered requests to the handler', async () => {
    const server = createServer();
    const call = createCall();
    const callback = vi.fn();

    const result = server.createRequestStreamMethod(consume, false)(
      call as any,
      callback,
    );
    call.emit('data', 'a');
    call.emit('data', 'b');
    call.emit('end');
    await result;

    expect(callback).toHaveBeenCalledExactlyOnceWith(null, ['a', 'b']);
  });
});

/**
 * createStreamCallMethod() decisions:
 * D1 `isResponseStream` (T: the handler owns the call, F: it also gets the
 *    callback).
 * D2 try/catch (T: the handler stream settles, F: it fails -> emitted for a
 *    response stream, passed to the callback otherwise).
 */
describe('ServerGrpc.createStreamCallMethod', () => {
  it('lets a response stream handler own the call', async () => {
    const server = createServer();
    const call = createCall();
    const handler = vi.fn(async (ownedCall: any) => {
      expect(ownedCall).toBe(call);
      return EMPTY;
    });

    await server.createStreamCallMethod(handler, true)(call as any, vi.fn());

    expect(handler).toHaveBeenCalledTimes(1);
    expect(call.emit).not.toHaveBeenCalled();
  });

  it('passes the callback to a non streaming handler', async () => {
    const server = createServer();
    const call = createCall();
    const callback = vi.fn();
    const handler = vi.fn(async (_call: any, _callback: any) => EMPTY);

    await server.createStreamCallMethod(handler, false)(call as any, callback);

    expect(handler.mock.calls[0][1]).toBe(callback);
  });

  it('emits the error of a failed response stream', async () => {
    const server = createServer();
    const call = createCall();
    const error = new Error('failed');

    await server.createStreamCallMethod(async () => {
      throw error;
    }, true)(call as any, vi.fn());

    expect(call.emit).toHaveBeenCalledExactlyOnceWith('error', error);
  });

  it('passes the error of a failed request stream to the callback', async () => {
    const server = createServer();
    const call = createCall();
    const callback = vi.fn();
    const error = new Error('failed');

    await server.createStreamCallMethod(
      async () => throwError(() => error),
      false,
    )(call as any, callback);

    expect(callback).toHaveBeenCalledExactlyOnceWith(error, null);
    expect(call.emit).not.toHaveBeenCalled();
  });
});

/**
 * createClient() decisions:
 * D1 `this.options && this.options.max*` (T: limit written into the channel
 *    options, F: absent - and F for `this.options` itself, which then throws
 *    in getKeepaliveOptions).
 * D2 `credentials || ServerCredentials.createInsecure()` (T/F).
 * D3 `error ? reject(error) : resolve(port)` (T: rejects, F: resolves).
 */
describe('ServerGrpc.createClient', () => {
  it('creates and binds a server with the channel options', async () => {
    const server = createServer({
      package: 'test',
      url: 'grpc:1',
      channelOptions: { 'grpc.primary_user_agent': 'app' },
      maxSendMessageLength: 1,
      maxReceiveMessageLength: 2,
      maxMetadataSize: 3,
      keepalive: { keepaliveTimeMs: 4, nope: 5 },
    });
    const { pkg, instances, insecure } = createFakeGrpcPackage();
    await installGrpcPackage(server, pkg);

    const client = await server.createClient();

    expect(client).toBe(instances[0]);
    expect(instances[0].options).toEqual({
      'grpc.primary_user_agent': 'app',
      'grpc.max_send_message_length': 1,
      'grpc.max_receive_message_length': 2,
      'grpc.max_metadata_size': 3,
      'grpc.keepalive_time_ms': 4,
    });
    expect(instances[0].bindAsync).toHaveBeenCalledWith(
      'grpc:1',
      insecure,
      expect.any(Function),
    );
  });

  it('uses the given credentials and no limits', async () => {
    const credentials = { custom: true };
    const server = createServer({ package: 'test', credentials });
    const { pkg, instances, insecure } = createFakeGrpcPackage();
    await installGrpcPackage(server, pkg);

    await server.createClient();

    expect(instances[0].options).toEqual({});
    expect(instances[0].bindAsync.mock.calls[0][1]).toBe(credentials);
    expect(instances[0].bindAsync.mock.calls[0][1]).not.toBe(insecure);
  });

  it('rejects when binding fails', async () => {
    const server = createServer();
    const { pkg } = createFakeGrpcPackage();
    const error = new Error('port in use');
    pkg.Server = class extends pkg.Server {
      public bindAsync = vi.fn(
        (_url: string, _credentials: any, callback: Function) =>
          callback(error),
      );
    } as any;
    await installGrpcPackage(server, pkg);

    await expect(server.createClient()).rejects.toBe(error);
  });

  it('rejects when the options are undefined', async () => {
    const server = createServer(null as any);
    await installGrpcPackage(server, createFakeGrpcPackage().pkg);

    await expect(server.createClient()).rejects.toBeInstanceOf(TypeError);
  });
});

/**
 * close() decisions:
 * D1 `if (this.grpcClient)` (T: shut down, F: nothing to do).
 * D2 `if (graceful)` (T: tryShutdown, F: forceShutdown).
 * D3 `if (error) reject(error) else resolve()` (T/F).
 */
describe('ServerGrpc.close', () => {
  it('does nothing without a grpc client', async () => {
    const server = createServer();

    await expect(server.close()).resolves.toBeUndefined();
  });

  it('force shuts the server down by default', async () => {
    const server = createServer();
    const grpcClient = { forceShutdown: vi.fn(), tryShutdown: vi.fn() };
    asAny(server).grpcClient = grpcClient;

    await server.close();

    expect(grpcClient.forceShutdown).toHaveBeenCalledTimes(1);
    expect(grpcClient.tryShutdown).not.toHaveBeenCalled();
    expect(asAny(server).grpcClient).toBeNull();
  });

  it('shuts the server down gracefully when configured', async () => {
    const server = createServer({
      ...defaultOptions(),
      gracefulShutdown: true,
    });
    const grpcClient = {
      forceShutdown: vi.fn(),
      tryShutdown: vi.fn((callback: Function) => callback()),
    };
    asAny(server).grpcClient = grpcClient;

    await server.close();

    expect(grpcClient.tryShutdown).toHaveBeenCalledTimes(1);
    expect(grpcClient.forceShutdown).not.toHaveBeenCalled();
  });

  it('rejects a failed graceful shutdown and still clears the client', async () => {
    const server = createServer({
      ...defaultOptions(),
      gracefulShutdown: true,
    });
    const error = new Error('shutdown failed');
    const grpcClient = {
      forceShutdown: vi.fn(),
      tryShutdown: vi.fn((callback: Function) => callback(error)),
    };
    asAny(server).grpcClient = grpcClient;

    await expect(server.close()).rejects.toBe(error);
    expect(asAny(server).grpcClient).toBeNull();
  });
});

/** deserialize() decisions: `JSON.parse` (T: parsed, F: returned as it is). */
describe('ServerGrpc.deserialize', () => {
  it('parses JSON', () => {
    const server = createServer();

    expect(server.deserialize('{"a":1}')).toEqual({ a: 1 });
  });

  it('returns a value that is not JSON as it is', () => {
    const server = createServer();

    expect(server.deserialize('not json')).toBe('not json');
  });
});

/** addHandler() decisions: `isString(pattern)` (T: raw key, F: JSON key). */
describe('ServerGrpc.addHandler', () => {
  it('stores a string pattern under its own key', () => {
    const server = createServer();
    const handler = vi.fn();

    server.addHandler('route', handler as any, true);

    expect(asAny(server).messageHandlers.get('route')).toBe(handler);
    expect(handler.isEventHandler).toBe(true);
  });

  it('serializes an object pattern', () => {
    const server = createServer();
    const handler = vi.fn();
    const pattern = { a: 1 };

    server.addHandler(pattern, handler as any);

    expect(asAny(server).messageHandlers.get(JSON.stringify(pattern))).toBe(
      handler,
    );
    expect(handler.isEventHandler).toBe(false);
  });
});

/** lookupPackage() decisions: `if (packageName)` (T/F), `if (!pkg) break` (T/F). */
describe('ServerGrpc.lookupPackage', () => {
  it('returns the root without a package name', () => {
    const server = createServer();
    const root = {};

    expect(server.lookupPackage(root, undefined as any)).toBe(root);
    expect(server.lookupPackage(root, '')).toBe(root);
  });

  it('walks the namespace and stops when a segment is missing', () => {
    const server = createServer();
    const service = {};
    const root = { a: { b: { service } } };

    expect(server.lookupPackage(root, 'a.b.service')).toBe(service);
    expect(server.lookupPackage(root, 'a.missing.service')).toBeUndefined();
  });
});

/**
 * loadProto() decisions:
 * D1 `if (this.options.onLoadPackageDefinition)` (T: called with the
 *    definition and the grpc server, F: not called).
 * D2 try/catch (T: loaded, F: InvalidProtoDefinitionException).
 * D3 `err && err.message` (T: its message is logged, F: the fallback).
 */
describe('ServerGrpc.loadProto', () => {
  it('loads the definition and hands it to onLoadPackageDefinition', async () => {
    const onLoadPackageDefinition = vi.fn();
    const server = createServer({
      package: 'test',
      packageDefinition: { test: {} },
      onLoadPackageDefinition,
    });
    const { pkg } = createFakeGrpcPackage();
    await installGrpcPackage(server, pkg);
    asAny(server).grpcClient = { fake: 'server' };

    const definition = server.loadProto();

    expect(definition).toEqual({ loaded: 'definition' });
    expect(onLoadPackageDefinition).toHaveBeenCalledWith(
      { test: {} },
      asAny(server).grpcClient,
    );
  });

  it('loads the definition without the callback', async () => {
    const server = createServer({
      package: 'test',
      packageDefinition: { test: {} },
    });
    const { pkg } = createFakeGrpcPackage();
    await installGrpcPackage(server, pkg);

    expect(server.loadProto()).toEqual({ loaded: 'definition' });
  });

  it('throws InvalidProtoDefinitionException for a mutex configuration', async () => {
    const server = createServer({
      package: 'test',
      protoPath: 'x.proto',
      packageDefinition: { test: {} },
    });
    const loggerError = silenceLogger(server);
    await installGrpcPackage(server, createFakeGrpcPackage().pkg);

    expect(() => server.loadProto()).toThrow(InvalidProtoDefinitionException);
    expect(loggerError).toHaveBeenCalledWith(
      expect.stringContaining('Both protoPath and packageDefinition'),
      expect.anything(),
    );
  });

  it('falls back to its own message when the thrown value has none', async () => {
    const server = createServer({
      package: 'test',
      packageDefinition: { test: {} },
    });
    const loggerError = silenceLogger(server);
    const { pkg } = createFakeGrpcPackage();
    pkg.loadPackageDefinition = vi.fn(() => {
      throw 'not an error';
    }) as any;
    await installGrpcPackage(server, pkg);

    expect(() => server.loadProto()).toThrow(InvalidProtoDefinitionException);
    expect(loggerError).toHaveBeenCalledWith(
      'The invalid .proto definition (file at "undefined" not found)',
      expect.anything(),
    );
  });
});

/**
 * bufferUntilDrained() decisions:
 * D1 `if (hasDrained || !replayBuffer)` (T: a no-op, F: the buffer is replayed).
 * D2 proxy `get`: `prop === 'asObservable'` (T/F) and `hasDrained` (T: the
 *    subject answers, F: the replay buffer answers).
 * D3 `next`: `if (replayBuffer)` (T/F) and `!hasDrained || !replayBuffer`
 *    (T: forwarded to the subject, F: only buffered).
 * D4 `error`/`complete`: `if (replayBuffer)` (T: buffered, F: forwarded).
 */
describe('ServerGrpc.bufferUntilDrained', () => {
  it('replays the buffered values in order and then forwards them', async () => {
    const server = createServer();
    const buffer = asAny(server).bufferUntilDrained();
    buffer.next('first');
    const stream = buffer.subject.asObservable();
    stream.drainBuffer();
    const result = lastValueFrom(stream.pipe(toArray()));

    // Between drainBuffer() and the flush, values are only buffered
    buffer.next('second');
    await tick();
    buffer.next('third');
    buffer.complete();

    expect(await result).toEqual(['first', 'second', 'third']);
  });

  it('completes the stream when the call ended before the handler subscribed', async () => {
    const server = createServer();
    const buffer = asAny(server).bufferUntilDrained();
    buffer.next('a');
    buffer.complete();
    const stream = buffer.subject.asObservable();
    const result = lastValueFrom(stream.pipe(toArray()));
    stream.drainBuffer();
    await tick();

    expect(await result).toEqual(['a']);
  });

  it('errors the stream when the call failed before the handler subscribed', async () => {
    const server = createServer();
    const buffer = asAny(server).bufferUntilDrained();
    const stream = buffer.subject.asObservable();
    const error = new Error('failed');
    const result = lastValueFrom(stream.pipe(toArray())).catch(err => err);
    buffer.error(error);
    await tick();

    expect(await result).toBe(error);
  });

  it('ignores a second drain request', async () => {
    const server = createServer();
    const buffer = asAny(server).bufferUntilDrained();
    buffer.next('a');
    const stream = buffer.subject.asObservable();
    const result = lastValueFrom(stream.pipe(toArray()));
    stream.drainBuffer();
    stream.drainBuffer();
    await tick();
    buffer.complete();

    expect(await result).toEqual(['a']);
  });

  it('answers other properties from the subject once drained', async () => {
    const server = createServer();
    const buffer = asAny(server).bufferUntilDrained();
    const stream = buffer.subject.asObservable();

    expect(typeof buffer.subject.pipe).toBe('function');

    stream.drainBuffer();
    await tick();

    expect(typeof buffer.subject.pipe).toBe('function');
  });
});

/**
 * createProcessingContext() decisions:
 * D1 `isFunction(call.metadata?.toJSON)` (T: metadata exposed, F: undefined).
 * D2 `values.length === 1 ? values[0] : undefined` (T: single value kept,
 *    F: several values dropped, as are non string values).
 */
describe('ServerGrpc.createProcessingContext', () => {
  it('objects the call, named by its handler, with its metadata', () => {
    const server = createServer();
    const metadata = new Metadata();
    metadata.set('x-request-id', 'trace-1');
    metadata.add('x-tag', 'a');
    metadata.add('x-tag', 'b');
    metadata.set('trace-bin', Buffer.from([0, 1]));
    const call = createCall({ metadata });
    function findOne() {
      return {};
    }

    const context = asAny(server).createProcessingContext(call, findOne);

    expect(context.operationId).toBe('findOne');
    expect(context.request).toBe(call.request);
    expect(context.metadata).toBe(metadata);
    expect(context.getMetadata()).toEqual({ 'x-request-id': 'trace-1' });
  });

  it.each([
    ['an empty metadata object', {}],
    ['no metadata', undefined],
  ])('returns undefined for %s', (_name, metadata) => {
    const server = createServer();
    const call = createCall({ metadata });

    const context = asAny(server).createProcessingContext(call, () => ({}));

    expect(context.getMetadata()).toBeUndefined();
  });
});

/** The methods gRPC does not support: each throws, no decision involved. */
describe('ServerGrpc unsupported methods', () => {
  it('throws from unwrap and on', () => {
    const server = createServer();

    expect(() => server.unwrap()).toThrow(
      'Method is not supported for gRPC transport',
    );
    expect(() => server.on('event', () => undefined)).toThrow(
      'Method is not supported in gRPC mode.',
    );
  });
});
