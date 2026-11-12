import { describe, expect, it } from 'vitest';
import {
  hasPacketMetadata,
  toPacketMetadata,
} from '../../../../packages/microservices/utils/packet-metadata.utils.js';

/**
 * C3 decisions of toPacketMetadata:
 * D1: isString(value)                     -> 1 (keep) / not 1 (skip)
 * D2: metadata ??= {}  (metadata === undefined) -> T (first kept entry) / F (later entries)
 *
 * C3 decisions of hasPacketMetadata:
 * D1: !!metadata && Object.keys(metadata).length > 0
 *     1c1: !!metadata                      -> T / F (F short-circuits 1c2)
 *     1c2: Object.keys(...).length > 0     -> T / F
 *
 * No infeasible paths: every condition is reachable from the public API.
 */
describe('toPacketMetadata', () => {
  // D1: c1, D2
  it.each([
    {
      title: 'D1(T) all entries are strings -> all kept',
      entries: [
        ['x-request-id', 'trace-1'],
        ['x-tenant', 'acme'],
      ],
      expected: { 'x-request-id': 'trace-1', 'x-tenant': 'acme' },
    },
    {
      title: 'D1(T) empty string still qualifies as a string',
      entries: [['empty', '']],
      expected: { empty: '' },
    },
    {
      title:
        'D1(F) non-string values are skipped (number, array, Buffer, null, undefined)',
      entries: [
        ['count', 3],
        ['tags', ['a', 'b']],
        ['binary', Buffer.from('abc')],
        ['nil', null],
        ['absent', undefined],
        ['nested', { a: 1 }],
      ],
      expected: undefined,
    },
    {
      title: 'D1(T) D1(F) mixed entries keep only the string ones',
      entries: [
        ['keep', 'yes'],
        ['drop-number', 1],
        ['drop-buffer', Buffer.from('x')],
        ['keep-too', ''],
      ],
      expected: { keep: 'yes', 'keep-too': '' },
    },
  ])('$title', ({ entries, expected }) => {
    // D2(T) on the first kept entry, D2(F) on every later one (mixed case)
    expect(toPacketMetadata(entries as Iterable<[string, unknown]>)).toEqual(
      expected,
    );
  });

  it('D1(F) empty iterable -> undefined (D2 never evaluated)', () => {
    expect(toPacketMetadata([])).toBeUndefined();
  });

  it('D1(T) accepts any Iterable, not just an array (Map entries)', () => {
    const map = new Map<string, unknown>([
      ['a', '1'],
      ['b', 2],
    ]);
    expect(toPacketMetadata(map.entries())).toEqual({ a: '1' });
  });
});

describe('hasPacketMetadata', () => {
  // D1: c1, c2
  it('D1 c1(T) c2(T) - object with entries', () => {
    expect(hasPacketMetadata({ 'x-request-id': 'trace-1' })).toBe(true);
  });

  it('D1 c1(T) c2(T) - several entries', () => {
    expect(hasPacketMetadata({ a: '1', b: '2' })).toBe(true);
  });

  it('D1 c1(T) c2(F) - empty object counts as no metadata', () => {
    expect(hasPacketMetadata({})).toBe(false);
  });

  it('D1 c1(F) - undefined (c2 is short-circuited)', () => {
    expect(hasPacketMetadata(undefined)).toBe(false);
  });

  it('D1 c1(F) - null is rejected by the truthiness check', () => {
    expect(hasPacketMetadata(null as any)).toBe(false);
  });
});
