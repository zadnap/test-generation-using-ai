import { describe, expect, it, vi } from 'vitest';
import { NatsContext } from '../../../../packages/microservices/ctx-host/nats.context.js';

/**
 * CFG / C3 decisions of NatsContext.getMetadata:
 * D1 headers defined (optional chaining)
 * D2 isFunction(headers.keys)  - false short-circuits the whole guard
 * D3 isFunction(headers.values) - only evaluated when D2 is true
 * D4 values.length === 1 (per key)
 * getSubject/getHeaders are straight-line getters.
 */
describe('NatsContext', () => {
  const subject = 'events.user';

  const buildHeaders = (
    entries: Record<string, string[]>,
  ): { keys: () => string[]; values: (key: string) => string[] } => ({
    keys: vi.fn(() => Object.keys(entries)),
    values: vi.fn((key: string) => entries[key]),
  });

  describe('getSubject', () => {
    // No decisions: returns tuple slot 0.
    it('returns the subject name', () => {
      expect(
        new NatsContext([subject, buildHeaders({})] as any).getSubject(),
      ).toBe(subject);
    });
  });

  describe('getHeaders', () => {
    // No decisions: returns tuple slot 1 as-is.
    it('returns the raw headers object', () => {
      const headers = buildHeaders({ a: ['1'] });

      expect(new NatsContext([subject, headers] as any).getHeaders()).toBe(
        headers,
      );
    });

    it('returns undefined when no headers were sent', () => {
      expect(new NatsContext([subject, undefined] as any).getHeaders()).toBe(
        undefined,
      );
    });
  });

  describe('getMetadata', () => {
    // D1(T)/D1(F), D2(T)/D2(F), D3(T)/D3(F), D4(T)/D4(F) covered.
    // No infeasible path.
    it('D2(T) D3(T) D4(T/F) - keeps single-value headers and drops multi-value ones', () => {
      const headers = buildHeaders({
        tenant: ['acme'],
        trace: ['a', 'b'],
      });

      expect(new NatsContext([subject, headers] as any).getMetadata()).toEqual({
        tenant: 'acme',
      });
    });

    it('D4(T) on an empty key list - returns undefined', () => {
      const headers = buildHeaders({});

      expect(
        new NatsContext([subject, headers] as any).getMetadata(),
      ).toBeUndefined();
    });

    it('D4(F) - returns undefined when every header has zero values', () => {
      const headers = buildHeaders({ empty: [] });

      expect(
        new NatsContext([subject, headers] as any).getMetadata(),
      ).toBeUndefined();
    });

    it('D1(F) - returns undefined when headers are missing', () => {
      expect(
        new NatsContext([subject, undefined] as any).getMetadata(),
      ).toBeUndefined();
    });

    it('D2(F) - returns undefined when keys() is not a function (values() is not reached)', () => {
      const headers = { keys: 'nope', values: vi.fn(() => ['1']) };

      expect(
        new NatsContext([subject, headers] as any).getMetadata(),
      ).toBeUndefined();
    });

    it('D2(T) D3(F) - returns undefined when values() is not a function', () => {
      const headers = { keys: vi.fn(() => ['a']), values: undefined };

      expect(
        new NatsContext([subject, headers] as any).getMetadata(),
      ).toBeUndefined();
    });

    it('D2(T) D3(T) D4(T) - a single header key resolves to one metadata entry', () => {
      const headers = {
        keys: vi.fn(() => ['b']),
        values: vi.fn(() => ['y']),
      };

      expect(new NatsContext([subject, headers] as any).getMetadata()).toEqual({
        b: 'y',
      });
    });
  });
});
