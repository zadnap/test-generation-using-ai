import { CUSTOM_ROUTE_ARGS_METADATA } from '../../../../packages/common/internal.js';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { MESSAGE_METADATA } from '../../../../packages/websockets/constants.js';
import { WsContextCreator } from '../../../../packages/websockets/context/ws-context-creator.js';
import { WsProxy } from '../../../../packages/websockets/context/ws-proxy.js';
import { MessageBody } from '../../../../packages/websockets/decorators/message-body.decorator.js';
import { SubscribeMessage } from '../../../../packages/websockets/decorators/subscribe-message.decorator.js';
import { WsParamtype } from '../../../../packages/websockets/enums/ws-paramtype.enum.js';
import { WsException } from '../../../../packages/websockets/errors/ws-exception.js';
import { WsParamsFactory } from '../../../../packages/websockets/factories/ws-params-factory.js';

const setup = () => {
  const wsProxy = new WsProxy();
  const exceptionHandler = { handle: vi.fn() };
  const exceptionFiltersContext = {
    create: vi.fn(() => exceptionHandler),
  };
  const pipesContextCreator = {
    create: vi.fn(() => []),
    createConcreteContext: vi.fn(() => []),
    setModuleContext: vi.fn(),
  };
  const pipesConsumer = {
    apply: vi.fn((value: unknown) => value),
  };
  const guardsContextCreator = {
    create: vi.fn(() => []),
  };
  const guardsConsumer = {
    tryActivate: vi.fn(async () => true),
  };
  const interceptorsContextCreator = {
    create: vi.fn(() => []),
  };
  const interceptorsConsumer = {
    intercept: vi.fn(
      (
        _interceptors: unknown[],
        _args: unknown[],
        _instance: unknown,
        _callback: Function,
        next: () => unknown,
      ) => next(),
    ),
  };
  const contextCreator = new WsContextCreator(
    wsProxy,
    exceptionFiltersContext as any,
    pipesContextCreator as any,
    pipesConsumer as any,
    guardsContextCreator as any,
    guardsConsumer as any,
    interceptorsContextCreator as any,
    interceptorsConsumer as any,
  );
  return {
    contextCreator,
    wsProxy,
    exceptionHandler,
    exceptionFiltersContext,
    pipesContextCreator,
    pipesConsumer,
    guardsContextCreator,
    guardsConsumer,
    interceptorsContextCreator,
    interceptorsConsumer,
  };
};

class Gateway {
  @SubscribeMessage('events')
  handle(@MessageBody('text') body: unknown) {
    return body;
  }

  plain(value: unknown) {
    return value;
  }
}

describe('WsContextCreator', () => {
  describe('create', () => {
    it('should build all enhancer contexts for a static handler', () => {
      const {
        contextCreator,
        exceptionFiltersContext,
        pipesContextCreator,
        guardsContextCreator,
        interceptorsContextCreator,
      } = setup();
      const gateway = new Gateway();

      const proxy = contextCreator.create(
        gateway,
        gateway.handle,
        'module',
        'handle',
      );

      expect(proxy).toBeTypeOf('function');
      expect(exceptionFiltersContext.create).toHaveBeenCalledWith(
        gateway,
        gateway.handle,
        'module',
        expect.anything(),
        undefined,
      );
      expect(pipesContextCreator.create).toHaveBeenCalled();
      expect(guardsContextCreator.create).toHaveBeenCalled();
      expect(interceptorsContextCreator.create).toHaveBeenCalled();
    });

    it('should apply parameter pipes and call the handler', async () => {
      const { contextCreator, pipesConsumer, pipesContextCreator } = setup();
      const gateway = new Gateway();
      const pipe = { transform: vi.fn((value: unknown) => `piped:${value}`) };
      pipesContextCreator.createConcreteContext.mockReturnValue([pipe]);
      pipesConsumer.apply.mockImplementation((value: unknown) => `piped:${value}`);

      const proxy = contextCreator.create(
        gateway,
        gateway.handle,
        'module',
        'handle',
      );

      await expect(proxy({}, { text: 'hello' })).resolves.toBe('piped:hello');
      expect(pipesConsumer.apply).toHaveBeenCalledWith(
        'hello',
        expect.objectContaining({ data: 'text' }),
        [pipe],
      );
    });

    it('should call a handler without parameter metadata directly', async () => {
      const { contextCreator } = setup();
      const gateway = new Gateway();
      const client = { client: true };
      const getMetadata = vi
        .spyOn(contextCreator, 'getMetadata')
        .mockReturnValue({
          argsLength: 0,
          paramtypes: undefined,
          getParamsMetadata: () => undefined as any,
        });

      const proxy = contextCreator.create(
        gateway,
        gateway.plain,
        'module',
        'plain',
      );

      await expect(proxy(client, 'value')).resolves.toBe(client);
      expect(getMetadata).toHaveBeenCalled();
    });

    it('should run guards and throw when activation is denied', async () => {
      const {
        contextCreator,
        guardsContextCreator,
        guardsConsumer,
        exceptionHandler,
      } = setup();
      guardsContextCreator.create.mockReturnValue([{ canActivate: () => false }]);
      guardsConsumer.tryActivate.mockResolvedValue(false);
      const gateway = new Gateway();

      const proxy = contextCreator.create(
        gateway,
        gateway.handle,
        'module',
        'handle',
      );

      await expect(proxy({}, {})).resolves.toBeUndefined();
      expect(exceptionHandler.handle).toHaveBeenCalledOnce();
    });

    it('should pass the ws context type to the interceptors consumer', async () => {
      const { contextCreator, interceptorsConsumer } = setup();
      const gateway = new Gateway();

      const proxy = contextCreator.create(
        gateway,
        gateway.handle,
        'module',
        'handle',
      );
      await proxy({}, {});

      expect(interceptorsConsumer.intercept).toHaveBeenCalledWith(
        [],
        expect.any(Array),
        gateway,
        gateway.handle,
        expect.any(Function),
        'ws',
      );
    });

    it('should append the subscriber pattern to the arguments', async () => {
      const { contextCreator, guardsConsumer, guardsContextCreator } = setup();
      guardsContextCreator.create.mockReturnValue([{ canActivate: () => true }]);
      const gateway = new Gateway();
      const proxy = contextCreator.create(
        gateway,
        gateway.handle,
        'module',
        'handle',
      );

      await proxy({}, {});
      expect(guardsConsumer.tryActivate.mock.calls[0][1]).toEqual([
        {},
        {},
        'events',
      ]);
      expect(guardsConsumer.tryActivate.mock.calls[0][2]).toBe(gateway);
      expect(guardsConsumer.tryActivate.mock.calls[0][3]).toBe(gateway.handle);
      expect(guardsConsumer.tryActivate.mock.calls[0][4]).toBe('ws');
    });
  });

  describe('reflectCallbackParamtypes', () => {
    it('should read the paramtypes metadata of the method', () => {
      const { contextCreator } = setup();
      const gateway = new Gateway();

      expect(
        contextCreator.reflectCallbackParamtypes(gateway, gateway.handle),
      ).toEqual([Object]);
    });
  });

  describe('reflectCallbackPattern', () => {
    it('should read the message metadata of the method', () => {
      const { contextCreator } = setup();
      const gateway = new Gateway();

      expect(contextCreator.reflectCallbackPattern(gateway.handle)).toBe(
        'events',
      );
      expect(
        contextCreator.reflectCallbackPattern(gateway.plain),
      ).toBeUndefined();
    });
  });

  describe('createGuardsFn', () => {
    it('should return null without guards', () => {
      const { contextCreator } = setup();

      expect(
        contextCreator.createGuardsFn([], {}, () => undefined),
      ).toBeNull();
    });

    it('should resolve when a guard allows activation', async () => {
      const { contextCreator, guardsConsumer } = setup();
      const fn = contextCreator.createGuardsFn(
        [{ canActivate: () => true }],
        {},
        () => undefined,
        'ws',
      )!;

      await expect((fn as any)(['arg'])).resolves.toBeUndefined();
      expect(guardsConsumer.tryActivate).toHaveBeenCalled();
    });

    it('should throw a WsException when activation is denied', async () => {
      const { contextCreator, guardsConsumer } = setup();
      guardsConsumer.tryActivate.mockResolvedValue(false);
      const fn = contextCreator.createGuardsFn(
        [{ canActivate: () => false }],
        {},
        () => undefined,
      )!;

      await expect((fn as any)(['arg'])).rejects.toBeInstanceOf(WsException);
    });
  });

  describe('getMetadata', () => {
    it('should cache metadata per instance and method', () => {
      const { contextCreator } = setup();
      const gateway = new Gateway();

      const first = contextCreator.getMetadata(gateway, 'handle', 'ws');
      const second = contextCreator.getMetadata(gateway, 'handle', 'ws');

      expect(second).toBe(first);
      expect(first.argsLength).toBe(1);
    });

    it('should use the default callback metadata when none is defined', () => {
      const { contextCreator } = setup();
      const gateway = new Gateway();

      const metadata = contextCreator.getMetadata(gateway, 'plain', 'ws');

      expect(metadata.argsLength).toBe(3);
    });

    it('should compute params metadata through the ws params factory', () => {
      const { contextCreator, pipesContextCreator } = setup();
      const gateway = new Gateway();
      const metadata = contextCreator.getMetadata(gateway, 'handle', 'ws');

      const params = metadata.getParamsMetadata('module');

      expect(pipesContextCreator.setModuleContext).toHaveBeenCalledWith(
        'module',
      );
      expect(params).toHaveLength(1);
      expect(params[0].type).toBe(WsParamtype.PAYLOAD);
      expect(params[0].extractValue({}, { text: 'hi' })).toBe('hi');
    });
  });

  describe('exchangeKeysForValues', () => {
    it('should create an extractor for a standard param type', () => {
      const { contextCreator, pipesContextCreator } = setup();
      pipesContextCreator.createConcreteContext.mockReturnValue(['pipe']);

      const result = contextCreator.exchangeKeysForValues(
        [`${WsParamtype.PAYLOAD}:1`],
        {
          [`${WsParamtype.PAYLOAD}:1`]: {
            index: 1,
            data: 'text',
            pipes: [],
            schema: { type: 'string' },
          },
        },
        'module',
        new WsParamsFactory(),
        () => ({}) as any,
      );

      expect(result[0]).toEqual(
        expect.objectContaining({
          index: 1,
          type: WsParamtype.PAYLOAD,
          data: 'text',
          pipes: ['pipe'],
          schema: { type: 'string' },
        }),
      );
      expect(result[0].extractValue({}, { text: 'hi' })).toBe('hi');
    });

    it('should create a custom extractor when the key is custom', () => {
      const { contextCreator } = setup();
      const factory = vi.fn((data: unknown, context: unknown) => ({
        data,
        context,
      }));
      const key = `${CUSTOM_ROUTE_ARGS_METADATA}:0`;

      const result = contextCreator.exchangeKeysForValues(
        [key],
        {
          [key]: { index: 0, data: 'id', pipes: [], factory },
        },
        'module',
        new WsParamsFactory(),
        () => ({}) as any,
      );

      expect(result[0].extractValue).toBeTypeOf('function');
      expect(result[0].extractValue({ args: true })).toEqual({
        data: 'id',
        context: {},
      });
    });
  });

  describe('createPipesFn', () => {
    it('should return null without params', () => {
      const { contextCreator } = setup();

      expect(contextCreator.createPipesFn([], [])).toBeNull();
    });

    it('should resolve each param and apply the collected pipes', async () => {
      const { contextCreator, pipesConsumer } = setup();
      pipesConsumer.apply.mockImplementation(
        (value: unknown) => `global:${value}`,
      );
      const fn = contextCreator.createPipesFn(
        [{ transform: (value: unknown) => value }],
        [
          {
            index: 1,
            extractValue: () => 'value',
            type: WsParamtype.PAYLOAD,
            data: undefined,
            pipes: [{ transform: (value: unknown) => value }],
          },
        ],
      )!;
      const args: unknown[] = [undefined, undefined];

      await fn(args, 'client', { text: 'x' });

      expect(args[1]).toBe('global:value');
    });
  });

  describe('getParamValue', () => {
    it('should return the value when there are no pipes', async () => {
      const { contextCreator, pipesConsumer } = setup();

      await expect(
        contextCreator.getParamValue('value', {} as any, []),
      ).resolves.toBe('value');
      expect(pipesConsumer.apply).not.toHaveBeenCalled();
    });

    it('should delegate to the pipes consumer', async () => {
      const { contextCreator, pipesConsumer } = setup();
      pipesConsumer.apply.mockResolvedValue('transformed');

      await expect(
        contextCreator.getParamValue('value', {} as any, [{} as any]),
      ).resolves.toBe('transformed');
    });
  });
});
