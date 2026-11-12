import { describe, expect, it, vi } from 'vitest';
import { RpcParamsFactory } from '../../../../packages/microservices/factories/rpc-params-factory.js';
import { RpcParamtype } from '../../../../packages/microservices/enums/rpc-paramtype.enum.js';

/**
 * CFG / C3 decisions of RpcParamsFactory.exchangeKeyForValue (and the
 * module-level getPayloadProperty helper it delegates to):
 * D1 !args                                  -> 1
 * D2 data truthy (PAYLOAD branch)           -> 2
 * D3 isObject(payload)                      -> 3a
 * D4 !Array.isArray(payload)                -> 3b
 * D5 !ArrayBuffer.isView(payload)           -> 3c
 * D6 !isNil(payload)                        -> 3d
 * D7 Object.hasOwn(Object(payload), key)    -> 3e
 * The helper's guard is (D3 && D4 && D5) || (D6 && D7).
 * switch(type): PAYLOAD / CONTEXT / GRPC_CALL / default.
 * No infeasible path: every atomic condition is reachable on both sides.
 */
describe('RpcParamsFactory', () => {
  const factory = new RpcParamsFactory();

  describe('exchangeKeyForValue', () => {
    // D1: !args -> null. T (undefined/null), F (empty and non-empty arrays).
    it.each([[undefined], [null]])(
      'D1(T) - returns null for falsy args %s',
      args => {
        expect(
          factory.exchangeKeyForValue(
            RpcParamtype.PAYLOAD,
            undefined,
            args as any,
          ),
        ).toBeNull();
      },
    );

    it('D1(F) - an empty args array falls through to the switch', () => {
      expect(
        factory.exchangeKeyForValue(RpcParamtype.PAYLOAD, undefined, []),
      ).toBeUndefined();
      expect(
        factory.exchangeKeyForValue(RpcParamtype.CONTEXT, undefined, []),
      ).toBeUndefined();
    });

    describe('PAYLOAD branch', () => {
      // D2(T): a data key is resolved through the payload property helper.
      it.each([
        ['plain object own property', { name: 'alice' }, 'name', 'alice'],
        [
          'object inherited property (custom deserializer class instances)',
          Object.create({ inherited: 'from-prototype' }),
          'inherited',
          'from-prototype',
        ],
        [
          'plain object missing property',
          { name: 'alice' },
          'missing',
          undefined,
        ],
        [
          'object own property holding undefined',
          { name: undefined },
          'name',
          undefined,
        ],
        ['array element index', [10, 20], '0', 10],
        ['array own length', [10, 20], 'length', 2],
        [
          'array prototype member is not exposed',
          [10, 20],
          'values',
          undefined,
        ],
        ['array prototype map is not exposed', [10, 20], 'map', undefined],
        ['Buffer element index', Buffer.from('abc'), '0', 97],
        [
          'Buffer prototype-backed parent is not exposed',
          Buffer.from('abc'),
          'parent',
          undefined,
        ],
        ['Uint8Array element index', new Uint8Array([7, 8]), '0', 7],
        [
          'Uint8Array prototype-backed byteLength is not exposed',
          new Uint8Array([7, 8]),
          'byteLength',
          undefined,
        ],
        ['string primitive own index', 'abc', '0', 'a'],
        ['string primitive own length', 'abc', 'length', 3],
        [
          'number primitive prototype method is not exposed',
          42,
          'toString',
          undefined,
        ],
        ['null payload does not throw', null, 'anything', undefined],
        ['undefined payload does not throw', undefined, 'anything', undefined],
      ])('D2(T) - %s', (_label, payload, key, expected) => {
        expect(
          factory.exchangeKeyForValue(RpcParamtype.PAYLOAD, key, [payload]),
        ).toBe(expected);
      });

      // D2(F): undefined and empty-string data return the whole payload.
      it.each([[undefined], ['']])(
        'D2(F) - data %p returns args[0] unchanged',
        data => {
          const payload = { name: 'alice' };

          expect(
            factory.exchangeKeyForValue(RpcParamtype.PAYLOAD, data, [payload]),
          ).toBe(payload);
        },
      );

      it('D2(F) - returns an array payload unchanged', () => {
        const payload = [1, 2, 3];

        expect(
          factory.exchangeKeyForValue(RpcParamtype.PAYLOAD, undefined, [
            payload,
          ]),
        ).toBe(payload);
      });
    });

    describe('CONTEXT branch', () => {
      // No decisions inside the branch itself; returns args[1].
      it('returns args[1]', () => {
        const context = { getArgs: () => [] };

        expect(
          factory.exchangeKeyForValue(RpcParamtype.CONTEXT, 'ignored', [
            'payload',
            context,
          ]),
        ).toBe(context);
      });

      it('returns undefined when args has no second entry', () => {
        expect(
          factory.exchangeKeyForValue(RpcParamtype.CONTEXT, undefined, [
            'payload',
          ]),
        ).toBeUndefined();
      });
    });

    describe('GRPC_CALL branch', () => {
      // No decisions inside the branch itself; returns args[2].
      it('returns args[2]', () => {
        const call = { getMetadata: () => ({}) };

        expect(
          factory.exchangeKeyForValue(RpcParamtype.GRPC_CALL, undefined, [
            'payload',
            'context',
            call,
          ]),
        ).toBe(call);
      });
    });

    describe('default branch', () => {
      // switch default: any non RPC paramtype returns null.
      it.each([[0], [1], [2], [99]])(
        'returns null for unsupported paramtype %i',
        type => {
          expect(
            factory.exchangeKeyForValue(type, 'data', [{ a: 1 }]),
          ).toBeNull();
        },
      );
    });
  });
});
