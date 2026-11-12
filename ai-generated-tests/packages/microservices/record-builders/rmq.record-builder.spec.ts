import { describe, expect, it } from 'vitest';
import {
  RmqRecord,
  RmqRecordBuilder,
} from '../../../../packages/microservices/record-builders/rmq.record-builder.js';

/**
 * CFG / C3 of rmq.record-builder.ts:
 * RmqRecord constructor, RmqRecordBuilder constructor, setOptions, setData and
 * build contain no decisions (C3 = 1 each); the setters are checked with and
 * without a previous value to cover both optional-argument shapes.
 * Infeasible: none.
 */
describe('rmq.record-builder', () => {
  describe('RmqRecord', () => {
    it('keeps data and options', () => {
      const options = { expiration: 1000, contentType: 'json' };

      const record = new RmqRecord({ id: 1 }, options);

      expect(record.data).toEqual({ id: 1 });
      expect(record.options).toBe(options);
    });

    it('allows options to be omitted', () => {
      const record = new RmqRecord('payload');

      expect(record.data).toBe('payload');
      expect(record.options).toBeUndefined();
    });

    it('keeps data undefined when built without a value', () => {
      expect(new RmqRecord(undefined).data).toBeUndefined();
    });
  });

  describe('RmqRecordBuilder constructor', () => {
    it('keeps the initial data', () => {
      const record = new RmqRecordBuilder('initial').build();

      expect(record.data).toBe('initial');
      expect(record.options).toBeUndefined();
    });

    it('leaves data undefined without an argument', () => {
      expect(new RmqRecordBuilder().build().data).toBeUndefined();
    });
  });

  describe('setOptions', () => {
    it('returns the builder itself', () => {
      const builder = new RmqRecordBuilder('a');

      expect(builder.setOptions({ expiration: 1 })).toBe(builder);
    });

    it('stores the options in the built record', () => {
      const options = {
        expiration: 1000,
        persistent: true,
        headers: { tenant: 'a' },
      };

      const record = new RmqRecordBuilder('a').setOptions(options).build();

      expect(record.options).toBe(options);
    });

    it('replaces previously set options', () => {
      const record = new RmqRecordBuilder('a')
        .setOptions({ expiration: 1 })
        .setOptions({ expiration: 2 })
        .build();

      expect(record.options).toEqual({ expiration: 2 });
    });
  });

  describe('setData', () => {
    it('returns the builder itself', () => {
      const builder = new RmqRecordBuilder('a');

      expect(builder.setData('b')).toBe(builder);
    });

    it('overrides the constructor data', () => {
      expect(new RmqRecordBuilder('a').setData('b').build().data).toBe('b');
    });

    it('accepts undefined', () => {
      expect(
        new RmqRecordBuilder('a').setData(undefined).build().data,
      ).toBeUndefined();
    });
  });

  describe('build', () => {
    it('returns an RmqRecord with the accumulated state', () => {
      const options = {
        expiration: 1000,
        CC: ['a', 'b'],
        priority: 3,
      };

      const record = new RmqRecordBuilder({ id: 1 })
        .setOptions(options)
        .build();

      expect(record).toBeInstanceOf(RmqRecord);
      expect(record.data).toEqual({ id: 1 });
      expect(record.options).toBe(options);
    });

    it('leaves options undefined when no setter was called', () => {
      expect(new RmqRecordBuilder('a').build().options).toBeUndefined();
    });

    it('returns a fresh record on every call', () => {
      const builder = new RmqRecordBuilder('a');

      expect(builder.build()).not.toBe(builder.build());
    });
  });
});
