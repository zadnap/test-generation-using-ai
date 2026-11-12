import { describe, expect, it } from 'vitest';
import { RmqRecord } from '../../../../packages/microservices/record-builders/rmq.record-builder.js';
import { RmqRecordSerializer } from '../../../../packages/microservices/serializers/rmq-record.serializer.js';

/**
 * CFG / C3 decisions of RmqRecordSerializer.serialize:
 * D1: packet?.data && isObject(packet.data) && packet.data instanceof RmqRecord
 *     conditions: c1 truthy data, c2 isObject(data), c3 instanceof RmqRecord
 * D2: packet?.response instanceof RmqRecord       (single condition)
 *
 * Infeasible: none.
 */
describe('RmqRecordSerializer', () => {
  const serializer = new RmqRecordSerializer();

  describe('serialize', () => {
    // ---------------------------------------------------------------- D1
    describe('D1 - data is an RmqRecord', () => {
      it('D1 c1 T c2 T c3 T - unwraps data and options', () => {
        const packet = {
          pattern: 'greeting',
          data: new RmqRecord({ id: 1 }, { expiration: 1000 }),
        };

        expect(serializer.serialize(packet)).toEqual({
          pattern: 'greeting',
          data: { id: 1 },
          options: { expiration: 1000 },
        });
      });

      it('D1 c1 T c2 T c3 T - an RmqRecord without options yields undefined options', () => {
        const packet = {
          pattern: 'greeting',
          data: new RmqRecord('payload'),
        };

        const result = serializer.serialize(packet);

        expect(result).toEqual({
          pattern: 'greeting',
          data: 'payload',
          options: undefined,
        });
        expect(result).not.toBe(packet);
      });

      it('D1 c1 T c2 T c3 F - a plain object data returns the packet unchanged', () => {
        const packet = { pattern: 'greeting', data: { id: 1 } };

        expect(serializer.serialize(packet)).toBe(packet);
      });

      it('D1 c1 T c2 F - a string data returns the packet unchanged', () => {
        const packet = { pattern: 'greeting', data: 'raw' };

        expect(serializer.serialize(packet)).toBe(packet);
      });

      it('D1 c1 F - a falsy (empty string) data returns the packet unchanged', () => {
        const packet = { pattern: 'greeting', data: '' };

        expect(serializer.serialize(packet)).toBe(packet);
      });

      it('D1 c1 F - an undefined data returns the packet unchanged', () => {
        const packet = { pattern: 'greeting', data: undefined };

        expect(serializer.serialize(packet)).toBe(packet);
      });
    });

    // ---------------------------------------------------------------- D2
    describe('D2 - response is an RmqRecord', () => {
      it('D2 T - unwraps response and options', () => {
        const packet = {
          pattern: 'greeting',
          response: new RmqRecord({ ok: true }, { persistent: true }),
        };

        expect(serializer.serialize(packet)).toEqual({
          pattern: 'greeting',
          response: { ok: true },
          options: { persistent: true },
        });
      });

      it('D2 T - response wins after a falsy data', () => {
        const packet = {
          pattern: 'greeting',
          data: '',
          response: new RmqRecord('done'),
        };

        expect(serializer.serialize(packet)).toEqual({
          pattern: 'greeting',
          data: '',
          response: 'done',
          options: undefined,
        });
      });

      it('D2 F - a plain response returns the packet unchanged', () => {
        const packet = { pattern: 'greeting', response: { ok: true } };

        expect(serializer.serialize(packet)).toBe(packet);
      });

      it('D2 F - nil packet is returned unchanged', () => {
        expect(serializer.serialize(null as any)).toBeNull();
        expect(serializer.serialize(undefined as any)).toBeUndefined();
      });
    });
  });
});
