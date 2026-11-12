import { describe, expect, it } from 'vitest';
import {
  createRedactor,
  DEFAULT_REDACT_CENSOR,
} from '../../../../../packages/common/services/utils/redact.util.js';

const redact = (paths: string[], value: unknown, censor?: string) =>
  createRedactor(paths, censor)!(value);

describe('createRedactor (C3)', () => {
  describe('paths', () => {
    it.each([
      { paths: [] as string[] },
      { paths: [''] },
      { paths: [' . '] },
      { paths: [' . ', '  '] },
    ])('returns undefined when no usable path is given (%j)', ({ paths }) => {
      expect(createRedactor(paths)).toBeUndefined();
    });

    it('uses the default censor', () => {
      expect(redact(['password'], { password: 'x' })).toEqual({
        password: DEFAULT_REDACT_CENSOR,
      });
    });

    it('accepts a custom censor', () => {
      expect(redact(['password'], { password: 'x' }, '***')).toEqual({
        password: '***',
      });
    });

    it('matches key names at any depth and case-insensitively', () => {
      expect(
        redact(['Password'], {
          password: 'a',
          user: { PASSWORD: 'b', profile: { password: 'c' } },
        }),
      ).toEqual({
        password: '[REDACTED]',
        user: { PASSWORD: '[REDACTED]', profile: { password: '[REDACTED]' } },
      });
    });

    it('replaces an object value as a whole', () => {
      expect(redact(['credentials'], { credentials: { user: 'u' } })).toEqual({
        credentials: '[REDACTED]',
      });
    });

    it('trims and ignores empty dotted segments', () => {
      expect(
        redact([' . user . . password . '], { user: { password: 'a' } }),
      ).toEqual({ user: { password: '[REDACTED]' } });
    });

    it('matches the last keys of a dotted path at any depth', () => {
      expect(
        redact(['user.password'], {
          user: { password: 'a', name: 'John' },
          admin: { password: 'b' },
          password: 'c',
          data: { user: { password: 'd' } },
        }),
      ).toEqual({
        user: { password: '[REDACTED]', name: 'John' },
        admin: { password: 'b' },
        password: 'c',
        data: { user: { password: '[REDACTED]' } },
      });
    });

    it('matches longer dotted paths', () => {
      expect(
        redact(['data.user.password'], {
          data: { user: { password: 'a' } },
          user: { password: 'b' },
        }),
      ).toEqual({
        data: { user: { password: '[REDACTED]' } },
        user: { password: 'b' },
      });
    });

    it('does not match a dotted path whose key differs', () => {
      expect(
        redact(['user.password'], { user: { name: 'a' }, password: 'b' }),
      ).toEqual({ user: { name: 'a' }, password: 'b' });
    });

    it('does not match a dotted path at the root', () => {
      expect(redact(['user.password'], { password: 'a' })).toEqual({
        password: 'a',
      });
    });

    it('does not match a dotted path with a different parent', () => {
      expect(redact(['user.password'], { admin: { password: 'a' } })).toEqual({
        admin: { password: 'a' },
      });
    });

    it('skips array indices in dotted paths', () => {
      expect(
        redact(['users.password'], {
          users: [{ password: 'a' }, { password: 'b' }],
        }),
      ).toEqual({
        users: [{ password: '[REDACTED]' }, { password: '[REDACTED]' }],
      });
    });

    it('combines simple keys and dotted paths', () => {
      expect(
        redact(['token', 'user.password'], {
          token: 'a',
          user: { password: 'b' },
        }),
      ).toEqual({
        token: '[REDACTED]',
        user: { password: '[REDACTED]' },
      });
    });
  });

  describe('values', () => {
    it.each([undefined, null, 1, 'password', true, Symbol('x')])(
      'returns the primitive %s unchanged',
      value => {
        expect(redact(['password'], value)).toBe(value);
      },
    );

    it('returns functions unchanged', () => {
      const fn = () => undefined;
      const value = { fn };
      expect(redact(['password'], value)).toBe(value);
    });

    it('traverses arrays and copies only changed arrays', () => {
      const untouched = [1, 2, 3];
      const value = {
        untouched,
        items: [{ password: 'a' }, { id: 1 }, [{ password: 'b' }], 'x'],
      };
      const result = redact(['password'], value) as typeof value;

      expect(result).not.toBe(value);
      expect(result.untouched).toBe(untouched);
      expect(result.items).toEqual([
        { password: '[REDACTED]' },
        { id: 1 },
        [{ password: '[REDACTED]' }],
        'x',
      ]);
    });

    it('returns the same array when nothing matches', () => {
      const items = [1, { id: 2 }];
      expect(redact(['password'], items)).toBe(items);
    });

    it('handles sparse arrays', () => {
      const items: unknown[] = [];
      items[5] = { password: 'a' };
      const result = redact(['password'], items) as unknown[];

      expect(result[5]).toEqual({ password: '[REDACTED]' });
      expect(result.length).toBe(6);
    });

    it('returns the same plain object when nothing matches', () => {
      const value = { user: { name: 'John' } };
      expect(redact(['password'], value)).toBe(value);
    });

    it('copies an own "__proto__" key as a property', () => {
      const value = JSON.parse('{"__proto__": {"password": "a"}, "id": 1}');
      const result = redact(['password'], value) as Record<string, any>;

      expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
      expect(Object.keys(result)).toEqual(['__proto__', 'id']);
      expect(result['__proto__']).toEqual({ password: '[REDACTED]' });
    });

    it('handles an object with a null prototype', () => {
      const value = Object.assign(Object.create(null), {
        password: 'a',
        keep: 1,
      });
      const result = redact(['password'], value) as Record<string, unknown>;

      expect(Object.getPrototypeOf(result)).toBeNull();
      expect(result).toEqual({ password: '[REDACTED]', keep: 1 });
    });
  });

  describe('errors', () => {
    it('redacts own properties while keeping the error intact', () => {
      const error = Object.assign(new Error('failed'), {
        code: 'E_HTTP',
        config: { headers: { authorization: 'Bearer x' } },
      });
      const result = redact(['authorization'], error) as typeof error;

      expect(result).not.toBe(error);
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('failed');
      expect(result.stack).toBe(error.stack);
      expect(result.code).toBe('E_HTTP');
      expect(result.config.headers.authorization).toBe('[REDACTED]');
      expect(error.config.headers.authorization).toBe('Bearer x');
    });

    it('redacts cause and AggregateError#errors', () => {
      const cause = Object.assign(new Error('cause'), { token: 'a' });
      const inner = Object.assign(new Error('inner'), { token: 'b' });
      const error = new AggregateError([inner], 'outer', { cause });
      const result = redact(['token'], error) as AggregateError;

      expect(result).toBeInstanceOf(AggregateError);
      expect((result.cause as any).token).toBe('[REDACTED]');
      expect((result.errors[0] as any).token).toBe('[REDACTED]');
      expect(
        Object.getOwnPropertyDescriptor(result, 'cause')!.enumerable,
      ).toBe(false);
    });

    it('does not duplicate enumerable cause or errors', () => {
      const error = Object.assign(new Error('x'), {
        cause: { token: 'a' },
        errors: [{ token: 'b' }],
      });
      const result = redact(['token'], error) as any;

      expect(result.cause.token).toBe('[REDACTED]');
      expect(result.errors[0].token).toBe('[REDACTED]');
    });
  });

  describe('maps and sets', () => {
    it('redacts map entries with string keys', () => {
      const map = new Map<unknown, unknown>([
        ['password', 'a'],
        ['user', { password: 'b' }],
        [1, { password: 'c' }],
        ['id', 1],
      ]);
      const result = redact(['password'], map) as Map<unknown, unknown>;

      expect(result).toBeInstanceOf(Map);
      expect([...result]).toEqual([
        ['password', '[REDACTED]'],
        ['user', { password: '[REDACTED]' }],
        [1, { password: '[REDACTED]' }],
        ['id', 1],
      ]);
      expect(map.get('password')).toBe('a');
    });

    it('returns the same map when nothing matches', () => {
      const map = new Map([['id', 1]]);
      expect(redact(['password'], map)).toBe(map);
    });

    it('redacts set values and copies changed sets', () => {
      const set = new Set([{ password: 'a' }, 'x']);
      const result = redact(['password'], set) as Set<unknown>;

      expect([...result]).toEqual([{ password: '[REDACTED]' }, 'x']);
      expect(set.has(set.values().next().value)).toBe(true);
    });

    it('returns the same set when nothing matches', () => {
      const set = new Set([{ id: 1 }]);
      expect(redact(['password'], set)).toBe(set);
    });
  });

  describe('class instances', () => {
    class User {
      constructor(
        public name: string,
        public password: string,
      ) {}
      greet() {
        return `Hi ${this.name}`;
      }
    }

    it('keeps the prototype of a copied instance', () => {
      const result = redact(['password'], {
        user: new User('John', 'secret'),
      }) as { user: User };

      expect(result.user).toBeInstanceOf(User);
      expect(result.user.password).toBe('[REDACTED]');
      expect(result.user.greet()).toBe('Hi John');
    });

    it('returns the same instance when nothing matches', () => {
      const user = new User('John', 'secret');
      expect(redact(['token'], user)).toBe(user);
    });
  });

  describe('opaque values', () => {
    it.each([
      ['Date', new Date()],
      ['RegExp', /password/],
      ['Promise', Promise.resolve('x')],
      ['WeakMap', new WeakMap()],
      ['WeakSet', new WeakSet()],
      ['ArrayBuffer', new ArrayBuffer(8)],
      ['Uint8Array', new Uint8Array(8)],
      ['DataView', new DataView(new ArrayBuffer(8))],
    ])('does not traverse a %s', (_label, opaque) => {
      expect(redact(['password'], opaque)).toBe(opaque);
    });

    it('does not traverse opaque values nested in objects', () => {
      const date = new Date();
      const buffer = Buffer.from('password');
      const bytes = new Uint8Array(3);
      const value = { date, buffer, bytes };

      expect(redact(['password'], value)).toBe(value);
    });
  });

  describe('cycles and shared references', () => {
    it('replaces circular references without throwing', () => {
      const value: any = { password: 'a', child: { password: 'b' } };
      value.child.parent = value;
      value.self = value;

      expect(redact(['password'], value)).toEqual({
        password: '[REDACTED]',
        child: { password: '[REDACTED]', parent: '[Circular]' },
        self: '[Circular]',
      });
      expect(value.child.parent).toBe(value);
    });

    it('handles circular arrays', () => {
      const value: any[] = [{ password: 'a' }];
      value.push(value);

      const result = redact(['password'], value) as unknown[];

      expect(result[0]).toEqual({ password: '[REDACTED]' });
      expect(result[1]).toBe('[Circular]');
    });

    it('copies a shared object once per context', () => {
      const shared = { password: 'a' };
      const result = redact(['password'], { a: shared, b: [shared] }) as {
        a: object;
        b: object[];
      };

      expect(result.a).toEqual({ password: '[REDACTED]' });
      expect(result.b[0]).toBe(result.a);
    });

    it('applies dotted paths per reference context', () => {
      const shared = { password: 'a' };
      expect(
        redact(['org.user.password'], {
          org: { user: shared },
          team: { user: shared },
        }),
      ).toEqual({
        org: { user: { password: '[REDACTED]' } },
        team: { user: { password: 'a' } },
      });
    });
  });

  describe('failures', () => {
    it('replaces the whole value when traversal throws', () => {
      const value = {
        get broken() {
          throw new Error('getter');
        },
      };

      expect(redact(['password'], value)).toBe('[REDACTED]');
    });

    it('does not mutate frozen input', () => {
      const value = Object.freeze({
        user: Object.freeze({ password: 'a' }),
      });

      expect(redact(['password'], value)).toEqual({
        user: { password: '[REDACTED]' },
      });
      expect(value.user.password).toBe('a');
    });
  });
});
