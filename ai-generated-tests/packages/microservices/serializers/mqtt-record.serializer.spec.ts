import { describe, expect, it } from 'vitest';
import { MqttRecord } from '../../../../packages/microservices/record-builders/mqtt.record-builder.js';
import { MqttRecordSerializer } from '../../../../packages/microservices/serializers/mqtt-record.serializer.js';

/**
 * CFG / C3 decisions of MqttRecordSerializer.serialize:
 * D1: isObject(packet?.data) && packet.data instanceof MqttRecord
 *     conditions: c1 isObject(packet?.data), c2 instanceof MqttRecord
 * D2: packet?.response instanceof MqttRecord   (single condition)
 *
 * The optional chaining on `packet?.data` / `packet?.response` short-circuits
 * for a nil packet, which is the D2 F path with no packet at all.
 * (c1 F of D1 is also reached with a nil packet and with primitive data.)
 * Infeasible: none.
 */
describe('MqttRecordSerializer', () => {
  const serializer = new MqttRecordSerializer();

  describe('serialize', () => {
    // ---------------------------------------------------------------- D1
    describe('D1 - data is an MqttRecord', () => {
      it('D1 c1 T c2 T - replaces data with the record payload', () => {
        const packet = {
          pattern: 'greeting',
          data: new MqttRecord({ id: 1 }, { qos: 1 }),
        };

        expect(JSON.parse(serializer.serialize(packet))).toEqual({
          pattern: 'greeting',
          data: { id: 1 },
        });
      });

      it('D1 c1 T c2 T - keeps the remaining packet fields', () => {
        const packet = {
          pattern: 'greeting',
          id: 'abc',
          data: new MqttRecord('payload'),
        };

        expect(JSON.parse(serializer.serialize(packet))).toEqual({
          pattern: 'greeting',
          id: 'abc',
          data: 'payload',
        });
      });

      it('D1 c1 T c2 F - a plain object data is left untouched', () => {
        const packet = { pattern: 'greeting', data: { id: 1 } };

        expect(JSON.parse(serializer.serialize(packet))).toEqual({
          pattern: 'greeting',
          data: { id: 1 },
        });
      });

      it('D1 c1 F - an undefined data is left untouched', () => {
        const packet = { pattern: 'greeting', data: undefined };

        expect(JSON.parse(serializer.serialize(packet))).toEqual({
          pattern: 'greeting',
        });
      });

      it('D1 c1 F - a string data is left untouched', () => {
        const packet = { pattern: 'greeting', data: 'raw' };

        expect(JSON.parse(serializer.serialize(packet))).toEqual({
          pattern: 'greeting',
          data: 'raw',
        });
      });
    });

    // ---------------------------------------------------------------- D2
    describe('D2 - response is an MqttRecord', () => {
      it('D2 T - replaces response with the record payload', () => {
        const packet = {
          pattern: 'greeting',
          response: new MqttRecord({ ok: true }),
        };

        expect(JSON.parse(serializer.serialize(packet))).toEqual({
          pattern: 'greeting',
          response: { ok: true },
        });
      });

      it('D2 T - data wins over response when both are MqttRecords', () => {
        const packet = {
          data: new MqttRecord('from-data'),
          response: new MqttRecord('from-response'),
        };

        expect(JSON.parse(serializer.serialize(packet))).toEqual({
          data: 'from-data',
          response: { data: 'from-response' },
        });
      });

      it('D2 F - a plain response object is left untouched', () => {
        const packet = { pattern: 'greeting', response: { ok: true } };

        expect(JSON.parse(serializer.serialize(packet))).toEqual({
          pattern: 'greeting',
          response: { ok: true },
        });
      });

      it('D2 F - a packet without records is stringified as is', () => {
        const packet = { pattern: 'greeting', data: { id: 1 } };

        expect(JSON.parse(serializer.serialize(packet))).toEqual(packet);
      });
    });

    // ---------------------------------------------------------------- nil packet
    describe('nil packet', () => {
      it('D1 c1 F + D2 F - null packet is stringified', () => {
        expect(serializer.serialize(null as any)).toBe('null');
      });

      it('D1 c1 F + D2 F - undefined packet yields undefined', () => {
        // JSON.stringify(undefined) returns undefined, not a string
        expect(serializer.serialize(undefined as any)).toBeUndefined();
      });
    });
  });
});
