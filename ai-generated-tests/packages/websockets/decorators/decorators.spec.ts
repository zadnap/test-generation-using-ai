import { describe, expect, it } from 'vitest';
import { RouteParamtypes } from '../../../../packages/common/internal.js';
import {
  GATEWAY_METADATA,
  GATEWAY_OPTIONS,
  GATEWAY_SERVER_METADATA,
  MESSAGE_MAPPING_METADATA,
  MESSAGE_METADATA,
  PARAM_ARGS_METADATA,
  PORT_METADATA,
} from '../../../../packages/websockets/constants.js';
import { Ack } from '../../../../packages/websockets/decorators/ack.decorator.js';
import { ConnectedSocket } from '../../../../packages/websockets/decorators/connected-socket.decorator.js';
import { WebSocketServer } from '../../../../packages/websockets/decorators/gateway-server.decorator.js';
import { MessageBody } from '../../../../packages/websockets/decorators/message-body.decorator.js';
import { WebSocketGateway } from '../../../../packages/websockets/decorators/socket-gateway.decorator.js';
import { SubscribeMessage } from '../../../../packages/websockets/decorators/subscribe-message.decorator.js';
import { WsParamtype } from '../../../../packages/websockets/enums/ws-paramtype.enum.js';

const paramsOf = (target: any, method: string) =>
  Reflect.getMetadata(PARAM_ARGS_METADATA, target, method) ?? {};

class PipeA {
  transform(value: unknown) {
    return value;
  }
}
class PipeB {
  transform(value: unknown) {
    return value;
  }
}

describe('WebSocketServer', () => {
  it('should initialise the property and mark it as a server holder', () => {
    class Gateway {
      @WebSocketServer()
      server: any = 'value';
    }

    expect((Gateway.prototype as any).server).toBeNull();
    expect(
      Reflect.getMetadata(GATEWAY_SERVER_METADATA, Gateway.prototype, 'server'),
    ).toBe(true);
  });
});

describe('SubscribeMessage', () => {
  it('should attach the mapping and message metadata to the method', () => {
    class Gateway {
      @SubscribeMessage('events')
      onEvent() {}
    }

    expect(
      Reflect.getMetadata(MESSAGE_MAPPING_METADATA, Gateway.prototype.onEvent),
    ).toBe(true);
    expect(
      Reflect.getMetadata(MESSAGE_METADATA, Gateway.prototype.onEvent),
    ).toBe('events');
  });

  it('should accept a non-string message', () => {
    class Gateway {
      @SubscribeMessage({ event: 'custom' })
      onEvent() {}
    }

    expect(
      Reflect.getMetadata(MESSAGE_METADATA, Gateway.prototype.onEvent),
    ).toEqual({ event: 'custom' });
  });
});

describe('WebSocketGateway', () => {
  it('should use a port with options', () => {
    @WebSocketGateway(3000, { namespace: '/chat' })
    class Gateway {}

    expect(Reflect.getMetadata(GATEWAY_METADATA, Gateway)).toBe(true);
    expect(Reflect.getMetadata(PORT_METADATA, Gateway)).toBe(3000);
    expect(Reflect.getMetadata(GATEWAY_OPTIONS, Gateway)).toEqual({
      namespace: '/chat',
    });
  });

  it('should treat an options object as options and default the port to 0', () => {
    @WebSocketGateway({ namespace: '/chat' })
    class Gateway {}

    expect(Reflect.getMetadata(PORT_METADATA, Gateway)).toBe(0);
    expect(Reflect.getMetadata(GATEWAY_OPTIONS, Gateway)).toEqual({
      namespace: '/chat',
    });
  });

  it('should default both port and options when called without arguments', () => {
    @WebSocketGateway()
    class Gateway {}

    expect(Reflect.getMetadata(PORT_METADATA, Gateway)).toBe(0);
    expect(Reflect.getMetadata(GATEWAY_OPTIONS, Gateway)).toEqual({});
  });

  it('should treat a non-integer argument as options', () => {
    @WebSocketGateway(1.5 as any)
    class Gateway {}

    expect(Reflect.getMetadata(PORT_METADATA, Gateway)).toBe(0);
    expect(Reflect.getMetadata(GATEWAY_OPTIONS, Gateway)).toBe(1.5);
  });
});

describe('ConnectedSocket', () => {
  it('should register the socket parameter at its index', () => {
    class Gateway {
      handle(@ConnectedSocket() client: unknown) {}
    }

    const params = paramsOf(Gateway.prototype.constructor, 'handle');
    expect(params[`${WsParamtype.SOCKET}:0`]).toEqual({
      index: 0,
      data: undefined,
      pipes: [],
    });
    expect(WsParamtype.SOCKET).toBe(RouteParamtypes.REQUEST);
  });
});

describe('Ack', () => {
  it('should register the ack parameter at its index', () => {
    class Gateway {
      handle(data: unknown, @Ack() ack: Function) {}
    }

    const params = paramsOf(Gateway.prototype.constructor, 'handle');
    expect(params[`${WsParamtype.ACK}:1`]).toEqual({
      index: 1,
      data: undefined,
      pipes: [],
    });
    expect(WsParamtype.ACK).toBe(RouteParamtypes.ACK);
  });
});

describe('MessageBody', () => {
  it('should register the payload parameter without data', () => {
    class Gateway {
      handle(@MessageBody() body: unknown) {}
    }

    const params = paramsOf(Gateway.prototype.constructor, 'handle');
    expect(params[`${WsParamtype.PAYLOAD}:0`]).toEqual({
      index: 0,
      data: undefined,
      pipes: [],
    });
    expect(WsParamtype.PAYLOAD).toBe(RouteParamtypes.BODY);
  });

  it('should store a property key and pipes', () => {
    class Gateway {
      handle(@MessageBody('text', PipeA, new PipeB()) body: unknown) {}
    }

    const params = paramsOf(Gateway.prototype.constructor, 'handle');
    expect(params[`${WsParamtype.PAYLOAD}:0`].data).toBe('text');
    expect(params[`${WsParamtype.PAYLOAD}:0`].pipes).toEqual([
      PipeA,
      expect.any(PipeB),
    ]);
  });

  it('should store options passed as the second argument', () => {
    const schema = { type: 'string' };
    const pipe = new PipeA();

    class Gateway {
      handle(@MessageBody('text', { pipes: [pipe], schema } as any) body: unknown) {}
    }

    const params = paramsOf(Gateway.prototype.constructor, 'handle');
    expect(params[`${WsParamtype.PAYLOAD}:0`]).toEqual({
      index: 0,
      data: 'text',
      pipes: [pipe],
      schema,
    });
  });

  it('should store options passed as the first argument', () => {
    const schema = { type: 'number' };
    const pipe = new PipeA();

    class Gateway {
      handle(@MessageBody({ pipes: [pipe], schema } as any) body: unknown) {}
    }

    const params = paramsOf(Gateway.prototype.constructor, 'handle');
    expect(params[`${WsParamtype.PAYLOAD}:0`]).toEqual({
      index: 0,
      data: undefined,
      pipes: [pipe],
      schema,
    });
  });

  it('should default options pipes to an empty array', () => {
    const schema = { type: 'number' };

    class Gateway {
      handle(@MessageBody({ schema } as any) body: unknown) {}
    }

    const params = paramsOf(Gateway.prototype.constructor, 'handle');
    expect(params[`${WsParamtype.PAYLOAD}:0`].pipes).toEqual([]);
  });

  it('should default second-argument options pipes to an empty array', () => {
    const schema = { type: 'number' };

    class Gateway {
      handle(@MessageBody('text', { schema } as any) body: unknown) {}
    }

    const params = paramsOf(Gateway.prototype.constructor, 'handle');
    expect(params[`${WsParamtype.PAYLOAD}:0`].pipes).toEqual([]);
    expect(params[`${WsParamtype.PAYLOAD}:0`].schema).toBe(schema);
  });

  it('should use pipes passed as the first argument when no data is given', () => {
    class Gateway {
      handle(@MessageBody(PipeA, PipeB) body: unknown) {}
    }

    const params = paramsOf(Gateway.prototype.constructor, 'handle');
    expect(params[`${WsParamtype.PAYLOAD}:0`]).toEqual({
      index: 0,
      data: undefined,
      pipes: [PipeA, PipeB],
      schema: undefined,
    });
  });

  it('should filter out falsy pipes', () => {
    class Gateway {
      handle(@MessageBody(undefined as any, undefined as any) body: unknown) {}
    }

    const params = paramsOf(Gateway.prototype.constructor, 'handle');
    expect(params[`${WsParamtype.PAYLOAD}:0`].pipes).toEqual([]);
  });

  it('should let a derived override replace the inherited parameter only', () => {
    class Base {
      handle(@ConnectedSocket() client: unknown, @MessageBody() body: unknown) {}
    }
    class Derived extends Base {
      override handle(@MessageBody('value') body: unknown) {}
    }

    const params = paramsOf(Derived.prototype.constructor, 'handle');
    expect(params[`${WsParamtype.PAYLOAD}:0`].data).toBe('value');
    expect(Object.keys(params)).toEqual(
      expect.arrayContaining([
        `${WsParamtype.PAYLOAD}:0`,
        `${WsParamtype.PAYLOAD}:1`,
      ]),
    );
  });
});
