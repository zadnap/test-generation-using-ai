import { describe, expect, it } from 'vitest';
import {
  MqttRecord,
  MqttRecordBuilder,
} from '../../../../packages/microservices/record-builders/mqtt.record-builder.js';

/**
 * CFG / C3 of mqtt.record-builder.ts:
 * MqttRecord constructor:      no decisions (C3 = 1)
 * MqttRecordBuilder ctor:      no decisions
 * setData, setQoS, setRetain, setDup, setProperties, build:
 *                              no decisions; each setter spreads the previous
 *                              options object, which is checked with and
 *                              without an existing options value.
 * Infeasible: none.
 */
describe('mqtt.record-builder', () => {
  describe('MqttRecord', () => {
    it('keeps data and options', () => {
      const options = { qos: 1 as const, retain: true };

      const record = new MqttRecord({ id: 1 }, options);

      expect(record.data).toEqual({ id: 1 });
      expect(record.options).toBe(options);
    });

    it('allows options to be omitted', () => {
      const record = new MqttRecord('payload');

      expect(record.data).toBe('payload');
      expect(record.options).toBeUndefined();
    });

    it('keeps data undefined when built without a value', () => {
      expect(new MqttRecord(undefined).data).toBeUndefined();
    });
  });

  describe('MqttRecordBuilder constructor', () => {
    it('keeps the initial data', () => {
      expect(new MqttRecordBuilder('initial').build().data).toBe('initial');
    });

    it('leaves data undefined without an argument', () => {
      expect(new MqttRecordBuilder().build().data).toBeUndefined();
    });
  });

  describe('setData', () => {
    it('returns the builder itself', () => {
      const builder = new MqttRecordBuilder('a');

      expect(builder.setData('b')).toBe(builder);
    });

    it('overrides the constructor data', () => {
      const record = new MqttRecordBuilder('a').setData('b').build();

      expect(record.data).toBe('b');
    });

    it('accepts undefined', () => {
      const record = new MqttRecordBuilder('a').setData(undefined).build();

      expect(record.data).toBeUndefined();
    });
  });

  describe('setQoS', () => {
    it('returns the builder itself', () => {
      const builder = new MqttRecordBuilder('a');

      expect(builder.setQoS(1)).toBe(builder);
    });

    it.each([[0], [1], [2]] as const)('stores qos %i', qos => {
      expect(new MqttRecordBuilder('a').setQoS(qos).build().options).toEqual({
        qos,
      });
    });

    it('merges with the options already set', () => {
      const record = new MqttRecordBuilder('a')
        .setRetain(true)
        .setQoS(2)
        .build();

      expect(record.options).toEqual({ retain: true, qos: 2 });
    });
  });

  describe('setRetain', () => {
    it('returns the builder itself', () => {
      const builder = new MqttRecordBuilder('a');

      expect(builder.setRetain(true)).toBe(builder);
    });

    it.each([[true], [false]])('stores retain %s', retain => {
      expect(
        new MqttRecordBuilder('a').setRetain(retain).build().options,
      ).toEqual({ retain });
    });

    it('merges with the options already set', () => {
      const record = new MqttRecordBuilder('a')
        .setQoS(1)
        .setRetain(true)
        .build();

      expect(record.options).toEqual({ qos: 1, retain: true });
    });
  });

  describe('setDup', () => {
    it('returns the builder itself', () => {
      const builder = new MqttRecordBuilder('a');

      expect(builder.setDup(true)).toBe(builder);
    });

    it.each([[true], [false]])('stores dup %s', dup => {
      expect(new MqttRecordBuilder('a').setDup(dup).build().options).toEqual({
        dup,
      });
    });

    it('merges with the options already set', () => {
      const record = new MqttRecordBuilder('a')
        .setDup(true)
        .setRetain(false)
        .build();

      expect(record.options).toEqual({ dup: true, retain: false });
    });
  });

  describe('setProperties', () => {
    it('returns the builder itself', () => {
      const builder = new MqttRecordBuilder('a');

      expect(builder.setProperties({ contentType: 'json' })).toBe(builder);
    });

    it('stores the MQTT 5 properties', () => {
      const properties = {
        messageExpiryInterval: 60,
        userProperties: { tenant: 'a' },
      };

      expect(
        new MqttRecordBuilder('a').setProperties(properties).build().options,
      ).toEqual({ properties });
    });

    it('merges with the options already set', () => {
      const record = new MqttRecordBuilder('a')
        .setQoS(1)
        .setProperties({ contentType: 'text/plain' })
        .build();

      expect(record.options).toEqual({
        qos: 1,
        properties: { contentType: 'text/plain' },
      });
    });
  });

  describe('build', () => {
    it('returns an MqttRecord with the accumulated state', () => {
      const record = new MqttRecordBuilder({ id: 1 })
        .setQoS(2)
        .setRetain(true)
        .setDup(false)
        .setProperties({ correlationData: Buffer.from('c') })
        .build();

      expect(record).toBeInstanceOf(MqttRecord);
      expect(record.data).toEqual({ id: 1 });
      expect(record.options).toEqual({
        qos: 2,
        retain: true,
        dup: false,
        properties: { correlationData: Buffer.from('c') },
      });
    });

    it('leaves options undefined when no setter was called', () => {
      expect(new MqttRecordBuilder('a').build().options).toBeUndefined();
    });

    it('returns a fresh record on every call', () => {
      const builder = new MqttRecordBuilder('a');

      expect(builder.build()).not.toBe(builder.build());
    });
  });
});
