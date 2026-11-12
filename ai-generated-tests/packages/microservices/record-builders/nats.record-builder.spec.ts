import { describe, expect, it } from 'vitest';
import {
  NatsRecord,
  NatsRecordBuilder,
} from '../../../../packages/microservices/record-builders/nats.record-builder.js';

/**
 * CFG / C3 of nats.record-builder.ts:
 * NatsRecord constructor, NatsRecordBuilder constructor, setHeaders, setData
 * and build contain no decisions (C3 = 1 each); the setters are checked with
 * and without a previous value to cover both optional-argument shapes.
 * Infeasible: none.
 */
describe('nats.record-builder', () => {
  describe('NatsRecord', () => {
    it('keeps data and headers', () => {
      const headers = { tenant: 'a' };

      const record = new NatsRecord({ id: 1 }, headers);

      expect(record.data).toEqual({ id: 1 });
      expect(record.headers).toBe(headers);
    });

    it('allows headers to be omitted', () => {
      const record = new NatsRecord('payload');

      expect(record.data).toBe('payload');
      expect(record.headers).toBeUndefined();
    });

    it('keeps data undefined when built without a value', () => {
      expect(new NatsRecord(undefined).data).toBeUndefined();
    });
  });

  describe('NatsRecordBuilder constructor', () => {
    it('keeps the initial data', () => {
      const record = new NatsRecordBuilder('initial').build();

      expect(record.data).toBe('initial');
      expect(record.headers).toBeUndefined();
    });

    it('leaves data undefined without an argument', () => {
      expect(new NatsRecordBuilder().build().data).toBeUndefined();
    });
  });

  describe('setHeaders', () => {
    it('returns the builder itself', () => {
      const builder = new NatsRecordBuilder('a');

      expect(builder.setHeaders({ tenant: 'a' })).toBe(builder);
    });

    it('stores the headers in the built record', () => {
      const headers = { tenant: 'a' };

      const record = new NatsRecordBuilder('a').setHeaders(headers).build();

      expect(record.headers).toBe(headers);
    });

    it('replaces previously set headers', () => {
      const record = new NatsRecordBuilder('a')
        .setHeaders({ tenant: 'a' })
        .setHeaders({ tenant: 'b' })
        .build();

      expect(record.headers).toEqual({ tenant: 'b' });
    });

    it('accepts a generic headers type with undefined', () => {
      const record = new NatsRecordBuilder<number>(1)
        .setHeaders<string | undefined>(undefined)
        .build();

      expect(record.headers).toBeUndefined();
      expect(record.data).toBe(1);
    });
  });

  describe('setData', () => {
    it('returns the builder itself', () => {
      const builder = new NatsRecordBuilder('a');

      expect(builder.setData('b')).toBe(builder);
    });

    it('overrides the constructor data', () => {
      expect(new NatsRecordBuilder('a').setData('b').build().data).toBe('b');
    });

    it('accepts undefined', () => {
      expect(
        new NatsRecordBuilder('a').setData(undefined).build().data,
      ).toBeUndefined();
    });
  });

  describe('build', () => {
    it('returns a NatsRecord with the accumulated state', () => {
      const headers = { tenant: 'a' };

      const record = new NatsRecordBuilder({ id: 1 })
        .setHeaders(headers)
        .build();

      expect(record).toBeInstanceOf(NatsRecord);
      expect(record.data).toEqual({ id: 1 });
      expect(record.headers).toBe(headers);
    });

    it('returns a fresh record on every call', () => {
      const builder = new NatsRecordBuilder('a');

      expect(builder.build()).not.toBe(builder.build());
    });
  });
});
