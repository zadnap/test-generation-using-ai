import { describe, expect, it } from 'vitest';
import { MqttContext } from '../../../../packages/microservices/ctx-host/mqtt.context.js';

/**
 * CFG / C3 decisions of MqttContext.getMetadata:
 * D1 args[1] defined (optional chaining)
 * D2 args[1].properties defined
 * D3 isObject(userProperties)
 * getTopic/getPacket are straight-line getters.
 */
describe('MqttContext', () => {
  const topic = 'sensors/temperature';
  const packet = {
    cmd: 'publish',
    properties: {
      userProperties: { tenant: 'acme', traceId: 'trace-9', count: 3 },
    },
  };

  describe('getTopic', () => {
    // No decisions: returns tuple slot 0.
    it('returns the topic name', () => {
      expect(new MqttContext([topic, packet] as any).getTopic()).toBe(topic);
    });
  });

  describe('getPacket', () => {
    // No decisions: returns tuple slot 1.
    it('returns the original MQTT packet reference', () => {
      expect(new MqttContext([topic, packet] as any).getPacket()).toBe(packet);
    });
  });

  describe('getMetadata', () => {
    // D1(T)/D1(F), D2(T)/D2(F), D3(T)/D3(F) covered. No infeasible path.
    it('D1(T) D2(T) D3(T) - keeps only string user property values', () => {
      const context = new MqttContext([topic, packet] as any);

      expect(context.getMetadata()).toEqual({
        tenant: 'acme',
        traceId: 'trace-9',
      });
    });

    it('D1(T) D2(T) D3(T) - returns undefined when no property value is a string', () => {
      const packetWithoutStrings = {
        properties: { userProperties: { retries: 2, nested: { a: 1 } } },
      };

      expect(
        new MqttContext([topic, packetWithoutStrings] as any).getMetadata(),
      ).toBeUndefined();
    });

    it('D1(T) D2(T) D3(F) - returns undefined when user properties are not an object', () => {
      const packetWithStringProperties = {
        properties: { userProperties: 'not-an-object' },
      };

      expect(
        new MqttContext([
          topic,
          packetWithStringProperties,
        ] as any).getMetadata(),
      ).toBeUndefined();
    });

    it('D1(T) D2(F) - returns undefined when the packet has no properties', () => {
      expect(
        new MqttContext([topic, { cmd: 'publish' }] as any).getMetadata(),
      ).toBeUndefined();
    });

    it('D1(F) - returns undefined when the packet itself is missing (MQTT 3)', () => {
      expect(
        new MqttContext([topic, undefined] as any).getMetadata(),
      ).toBeUndefined();
    });

    it('D3(T) with empty user properties - returns undefined', () => {
      const packetWithEmptyProperties = {
        properties: { userProperties: {} },
      };

      expect(
        new MqttContext([
          topic,
          packetWithEmptyProperties,
        ] as any).getMetadata(),
      ).toBeUndefined();
    });
  });
});
