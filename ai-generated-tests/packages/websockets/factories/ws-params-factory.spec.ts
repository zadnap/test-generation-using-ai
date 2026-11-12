import { describe, expect, it } from 'vitest';
import { WsParamtype } from '../../../../packages/websockets/enums/ws-paramtype.enum.js';
import { WsParamsFactory } from '../../../../packages/websockets/factories/ws-params-factory.js';

const factory = new WsParamsFactory();
const client = { id: 1 };
const extract = (payload: unknown, key?: string) =>
  factory.exchangeKeyForValue(WsParamtype.PAYLOAD, key, [client, payload]);

describe('WsParamsFactory', () => {
  it('should return null when args are missing', () => {
    expect(
      factory.exchangeKeyForValue(WsParamtype.PAYLOAD, undefined, null as any),
    ).toBeNull();
  });

  it('should return the socket argument', () => {
    expect(
      factory.exchangeKeyForValue(WsParamtype.SOCKET, undefined, [client]),
    ).toBe(client);
  });

  it('should return the whole payload when no key is given', () => {
    expect(extract({ text: 'hi' })).toEqual({ text: 'hi' });
    expect(extract(undefined)).toBeUndefined();
  });

  it('should return an own property of the payload', () => {
    expect(extract({ text: 'hi' }, 'text')).toBe('hi');
  });

  it('should resolve inherited properties of an object payload', () => {
    class Message {
      get text() {
        return 'inherited';
      }
    }
    expect(extract(new Message(), 'text')).toBe('inherited');
  });

  it.each([
    [Buffer.from('x'), 'parent'],
    [[], 'values'],
    ['text', 'search'],
    [1, 'toFixed'],
    [null, 'data'],
    [undefined, 'data'],
  ])(
    'should not resolve a prototype member of a non-plain payload',
    (payload: unknown, key: string) => {
      expect(extract(payload, key)).toBeUndefined();
    },
  );

  it.each([
    [['a'], '0', 'a'],
    [['a'], 'length', 1],
    ['text', 'length', 4],
    [Buffer.from('ab'), '0', 97],
  ])(
    'should resolve own properties of %j',
    (payload: unknown, key: string, expected: unknown) => {
      expect(extract(payload, key)).toBe(expected);
    },
  );

  it('should find the ack function among the arguments', () => {
    const ack = () => undefined;
    expect(
      factory.exchangeKeyForValue(WsParamtype.ACK, undefined, [
        client,
        {},
        ack,
      ]),
    ).toBe(ack);
  });

  it('should return undefined when there is no ack function', () => {
    expect(
      factory.exchangeKeyForValue(WsParamtype.ACK, undefined, [client, {}]),
    ).toBeUndefined();
  });

  it('should return null for an unknown param type', () => {
    expect(factory.exchangeKeyForValue(-1, undefined, [client])).toBeNull();
  });
});
