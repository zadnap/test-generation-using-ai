import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REDACT_CENSOR,
  createRedactor,
} from '../../../../../packages/common/services/utils/redact.util.js';

describe('createRedactor', () => {
  it.each([
    ['no paths', []],
    ['blank paths', ['', '   ', '.']],
  ])('returns undefined for %s', (_label, paths) => {
    expect(createRedactor(paths)).toBeUndefined();
  });

  it('redacts a key at any depth without mutating the input', () => {
    const redact = createRedactor(['password'])!;
    const value = { password: 'a', nested: { password: 'b', safe: 1 } };
    const result: any = redact(value);
    expect(result.password).toBe(DEFAULT_REDACT_CENSOR);
    expect(result.nested.password).toBe(DEFAULT_REDACT_CENSOR);
    expect(result.nested.safe).toBe(1);
    expect(value.password).toBe('a');
  });

  it('compares keys case-insensitively', () => {
    const redact = createRedactor(['PassWord'])!;
    expect((redact({ PASSWORD: 'x' }) as any).PASSWORD).toBe(
      DEFAULT_REDACT_CENSOR,
    );
  });

  it('supports a custom censor', () => {
    const redact = createRedactor(['secret'], '***')!;
    expect((redact({ secret: 'x' }) as any).secret).toBe('***');
  });

  it('redacts dotted paths at any depth', () => {
    const redact = createRedactor(['user.password'])!;
    const value = { a: { user: { password: 'x' } }, user: { password: 'y' } };
    const result: any = redact(value);
    expect(result.a.user.password).toBe(DEFAULT_REDACT_CENSOR);
    expect(result.user.password).toBe(DEFAULT_REDACT_CENSOR);
  });

  it('does not redact a key under the wrong parent', () => {
    const redact = createRedactor(['user.password'])!;
    const value = { account: { password: 'x' } };
    expect(redact(value)).toBe(value);
  });

  it('skips array indices when matching dotted paths', () => {
    const redact = createRedactor(['users.password'])!;
    const value = { users: [{ password: 'x' }, { password: 'y' }] };
    const result: any = redact(value);
    expect(result.users[0].password).toBe(DEFAULT_REDACT_CENSOR);
    expect(result.users[1].password).toBe(DEFAULT_REDACT_CENSOR);
  });

  it('returns the same reference when nothing matches', () => {
    const redact = createRedactor(['password'])!;
    const value = { safe: { nested: 1 } };
    expect(redact(value)).toBe(value);
    expect(redact('text')).toBe('text');
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
  });

  it('returns the same array when nothing matches and a copy when it does', () => {
    const redact = createRedactor(['password'])!;
    const unchanged = [{ safe: 1 }];
    expect(redact(unchanged)).toBe(unchanged);
    const changed = [{ password: 'x' }];
    expect(redact(changed)).not.toBe(changed);
  });

  it('redacts Map string keys and traverses non-string keys', () => {
    const redact = createRedactor(['password'])!;
    const map = new Map<any, any>([
      ['password', 'x'],
      [1, { password: 'y' }],
    ]);
    const result = redact(map) as Map<any, any>;
    expect(result.get('password')).toBe(DEFAULT_REDACT_CENSOR);
    expect(result.get(1).password).toBe(DEFAULT_REDACT_CENSOR);
  });

  it('returns the same Map when nothing matches', () => {
    const redact = createRedactor(['password'])!;
    const map = new Map([['safe', 1]]);
    expect(redact(map)).toBe(map);
  });

  it('redacts Set values and returns the same Set when nothing matches', () => {
    const redact = createRedactor(['password'])!;
    const changed = new Set([{ password: 'x' }]);
    expect([...(redact(changed) as Set<any>)][0].password).toBe(
      DEFAULT_REDACT_CENSOR,
    );
    const unchanged = new Set([{ safe: 1 }]);
    expect(redact(unchanged)).toBe(unchanged);
  });

  it('replaces circular references', () => {
    const redact = createRedactor(['password'])!;
    const value: any = { password: 'x' };
    value.self = value;
    const result: any = redact(value);
    expect(result.password).toBe(DEFAULT_REDACT_CENSOR);
    expect(result.self).toBe('[Circular]');
  });

  it('redacts an error cause and AggregateError errors', () => {
    const redact = createRedactor(['password'])!;
    const cause = Object.assign(new Error('cause'), { password: 'x' });
    const error: any = Object.assign(new Error('root'), {
      cause,
      password: 'y',
    });
    const result: any = redact(error);
    expect(result.password).toBe(DEFAULT_REDACT_CENSOR);
    expect(result.cause.password).toBe(DEFAULT_REDACT_CENSOR);
    expect(result).toBeInstanceOf(Error);

    const aggregate: any = new AggregateError([
      Object.assign(new Error('a'), { password: 'z' }),
    ], 'agg');
    const aggregateResult: any = redact(aggregate);
    expect(aggregateResult.errors[0].password).toBe(DEFAULT_REDACT_CENSOR);
  });

  it('returns the same error when nothing matches', () => {
    const redact = createRedactor(['password'])!;
    const error = new Error('safe');
    expect(redact(error)).toBe(error);
  });

  it.each([
    ['Date', new Date()],
    ['RegExp', /x/],
    ['Promise', Promise.resolve()],
    ['WeakMap', new WeakMap()],
    ['WeakSet', new WeakSet()],
    ['ArrayBuffer', new ArrayBuffer(1)],
    ['typed array', new Uint8Array([1])],
  ])('returns opaque %s values as is', (_label, value) => {
    const redact = createRedactor(['password'])!;
    expect(redact(value)).toBe(value);
  });

  it('preserves class instances and their prototype when redacting', () => {
    class Model {
      constructor(public password: string) {}
      method() {
        return 'ok';
      }
    }
    const redact = createRedactor(['password'])!;
    const result: any = redact(new Model('x'));
    expect(result).toBeInstanceOf(Model);
    expect(result.password).toBe(DEFAULT_REDACT_CENSOR);
    expect(result.method()).toBe('ok');
  });

  it('returns the censor when traversal throws', () => {
    const redact = createRedactor(['password'])!;
    const value = {
      get broken() {
        throw new Error('boom');
      },
    };
    expect(redact(value)).toBe(DEFAULT_REDACT_CENSOR);
  });

  it('handles an own __proto__ key safely', () => {
    const redact = createRedactor(['__proto__'])!;
    const value = JSON.parse('{"__proto__":{"x":1},"safe":1}');
    const result: any = redact(value);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.hasOwn(result, '__proto__')).toBe(true);
    expect(result.safe).toBe(1);
  });

  it('keeps non-enumerable stack access working on errors', () => {
    const redact = createRedactor(['password'])!;
    const error: any = Object.assign(new Error('x'), { password: 'y' });
    const result: any = redact(error);
    expect(typeof result.stack).toBe('string');
  });
});
