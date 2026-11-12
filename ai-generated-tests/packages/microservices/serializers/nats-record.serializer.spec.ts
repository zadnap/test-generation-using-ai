import { describe, expect, it } from 'vitest';
import { NatsRecord } from '../../../../packages/microservices/record-builders/nats.record-builder.js';
import { NatsRecordSerializer } from '../../../../packages/microservices/serializers/nats-record.serializer.js';

/**
 * CFG / C3 decisions of NatsRecordSerializer.serialize:
 * D1: packet?.response instanceof NatsRecord          (single condition)
 * D2: packet?.data && isObject(packet.data) && packet.data instanceof NatsRecord
 *     conditions: c1 truthy data, c2 isObject(data), c3 instanceof NatsRecord
 *
 * The optional chaining handles a nil packet: both D1 and D2 c1 are false and
 * the fallback builder runs with undefined data/headers.
 * Infeasible: none.
 */
describe('NatsRecordSerializer', () => {
  const serializer = new NatsRecordSerializer();

  describe('serialize', () => {
    // ---------------------------------------------------------------- D1
    describe('D1 - response is a NatsRecord', () => {
      it('D1 T - unwraps response and keeps its headers', () => {
        const packet = {
          pattern: 'greeting',
          response: new NatsRecord({ ok: true }, { tenant: 'a' }),
        };

        const result = serializer.serialize(packet);

        expect(JSON.parse(result.data)).toEqual({
          pattern: 'greeting',
          response: { ok: true },
        });
        expect(result.headers).toEqual({ tenant: 'a' });
      });

      it('D1 T - response record without headers yields undefined headers', () => {
        const packet = {
          pattern: 'greeting',
          response: new NatsRecord('payload'),
        };

        const result = serializer.serialize(packet);

        expect(JSON.parse(result.data)).toEqual({
          pattern: 'greeting',
          response: 'payload',
        });
        expect(result.headers).toBeUndefined();
      });

      it('D1 F - a plain response falls through to the data handling', () => {
        const packet = {
          pattern: 'greeting',
          response: { ok: true },
          data: { id: 1 },
        };

        const result = serializer.serialize(packet);

        expect(JSON.parse(result.data)).toEqual({
          pattern: 'greeting',
          response: { ok: true },
          data: { id: 1 },
        });
      });
    });

    // ---------------------------------------------------------------- D2
    describe('D2 - data is a NatsRecord', () => {
      it('D2 c1 T c2 T c3 T - unwraps data and keeps its headers', () => {
        const packet = {
          pattern: 'greeting',
          data: new NatsRecord({ id: 1 }, { tenant: 'b' }),
        };

        const result = serializer.serialize(packet);

        expect(JSON.parse(result.data)).toEqual({
          pattern: 'greeting',
          data: { id: 1 },
        });
        expect(result.headers).toEqual({ tenant: 'b' });
      });

      it('D2 c1 T c2 T c3 F - a plain object data goes through the builder', () => {
        const packet = {
          pattern: 'greeting',
          data: { id: 1 },
          headers: { tenant: 'c' },
        };

        const result = serializer.serialize(packet);

        expect(JSON.parse(result.data)).toEqual({
          pattern: 'greeting',
          data: { id: 1 },
          headers: { tenant: 'c' },
        });
        expect(result.headers).toEqual({ tenant: 'c' });
      });

      it('D2 c1 T c2 F - a string data goes through the builder', () => {
        const packet = { pattern: 'greeting', data: 'raw' };

        const result = serializer.serialize(packet);

        expect(JSON.parse(result.data)).toEqual({
          pattern: 'greeting',
          data: 'raw',
        });
        expect(result.headers).toBeUndefined();
      });

      it('D2 c1 F - an undefined data goes through the builder', () => {
        const packet = { pattern: 'greeting', data: undefined };

        const result = serializer.serialize(packet);

        expect(JSON.parse(result.data)).toEqual({ pattern: 'greeting' });
        expect(result.headers).toBeUndefined();
      });
    });

    // ---------------------------------------------------------------- nil packet
    describe('nil packet', () => {
      it('D1 F + D2 c1 F - null packet builds an empty payload', () => {
        const result = serializer.serialize(null);

        expect(JSON.parse(result.data)).toEqual({});
        expect(result.headers).toBeUndefined();
      });

      it('D1 F + D2 c1 F - undefined packet builds an empty payload', () => {
        const result = serializer.serialize(undefined);

        expect(JSON.parse(result.data)).toEqual({});
        expect(result.headers).toBeUndefined();
      });
    });
  });
});
