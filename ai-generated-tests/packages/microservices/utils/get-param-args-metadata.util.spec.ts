import { describe, expect, it } from 'vitest';
import { getParamArgsMetadata } from '../../../../packages/microservices/utils/get-param-args-metadata.util.js';

/**
 * C3 decisions of getParamArgsMetadata:
 * D1: Reflect.getMetadata(ctor) || {}                  -> T / F (fallback used)
 * D2: Reflect.getMetadata(parent ctor) || {}           -> T / F (fallback used)
 * D3: arg.index !== index || arg !== inherited[argKey] -> T / F
 *     3c1: arg.index !== index                         -> T (keep) / F (continue)
 *     3c2: arg !== inherited[argKey]                   -> T (keep, different ref) / F (filter)
 *
 * No infeasible paths: all combinations are reachable by defining metadata on a
 * parent class and/or the child class.
 */

let keyCounter = 0;
const uniqueKey = () => `ai-test:param-args-metadata:${keyCounter++}`;

describe('getParamArgsMetadata', () => {
  // D1: F, D2: F
  it('D1(F) D2(F) - no metadata at all returns an empty record', () => {
    class Target {
      public method(_arg: unknown) {}
    }
    expect(
      getParamArgsMetadata(uniqueKey(), Target.prototype, 'method', 0),
    ).toEqual({});
  });

  // D1: T, D2: F, D3: 3c1(T)
  it('D1(T) D2(F) D3 c1(T) - entry declared at another index is kept', () => {
    const key = uniqueKey();
    class Target {
      public method(_arg: unknown) {}
    }
    const otherIndexEntry = { index: 1 };
    Reflect.defineMetadata(key, { '3:1': otherIndexEntry }, Target, 'method');

    const result = getParamArgsMetadata(key, Target.prototype, 'method', 0);

    expect(result).toEqual({ '3:1': otherIndexEntry });
    expect(result['3:1']).toBe(otherIndexEntry);
  });

  // D1: T (inherited metadata is visible), D2: T, D3: c1(F) c2(F)
  it('D3 c1(F) c2(F) - entry inherited at the decorated index keeps the parent reference and is filtered', () => {
    const key = uniqueKey();
    class Parent {
      public method(_arg: unknown) {}
    }
    class Child extends Parent {
      public override method(_arg: unknown) {}
    }
    const inheritedAtZero = { index: 0 };
    const keptEntry = { index: 1 };
    Reflect.defineMetadata(
      key,
      { '3:0': inheritedAtZero, '3:1': keptEntry },
      Parent,
      'method',
    );
    // assignMetadata spreads shallowly, so an override that does not replace the
    // entry at index 0 keeps the very same object reference in its own record.
    Reflect.defineMetadata(
      key,
      { '3:0': inheritedAtZero, '3:1': keptEntry },
      Child,
      'method',
    );

    const result = getParamArgsMetadata(key, Child.prototype, 'method', 0);

    expect(result).toEqual({ '3:1': keptEntry });
    expect(result['3:0']).toBeUndefined();
  });

  // D1: T, D2: T, D3: c1(F) c2(T)
  it('D3 c1(F) c2(T) - override declares a new entry at the same index -> kept', () => {
    const key = uniqueKey();
    class Parent {
      public method(_arg: unknown) {}
    }
    class Child extends Parent {
      public override method(_arg: unknown) {}
    }
    const parentEntry = { index: 0, marker: 'parent' };
    const childEntry = { index: 0, marker: 'child' };
    Reflect.defineMetadata(key, { '3:0': parentEntry }, Parent, 'method');
    Reflect.defineMetadata(key, { '3:0': childEntry }, Child, 'method');

    const result = getParamArgsMetadata(key, Child.prototype, 'method', 0);

    expect(result).toEqual({ '3:0': childEntry });
    expect(result['3:0']).not.toBe(parentEntry);
  });

  // D1: T, D2: F, D3: c1(F) c2(T) with a missing inherited entry (parent fallback {})
  it('D2(F) D3 c1(F) c2(T) - no parent metadata, same index -> undefined !== entry keeps it', () => {
    const key = uniqueKey();
    class Target {
      public method(_arg: unknown) {}
    }
    const entry = { index: 0 };
    Reflect.defineMetadata(key, { '3:0': entry }, Target, 'method');

    const result = getParamArgsMetadata(key, Target.prototype, 'method', 0);

    expect(result).toEqual({ '3:0': entry });
  });

  it('D3 c1(T) D3 c1(F) - mixed record keeps other indexes and drops only the inherited one', () => {
    const key = uniqueKey();
    class Parent {
      public method(_a: unknown, _b: unknown) {}
    }
    class Child extends Parent {
      public override method(_a: unknown, _b: unknown) {}
    }
    const inheritedAtOne = { index: 1 };
    const parentOnly = { index: 2 };
    const ownAtZero = { index: 0, marker: 'own' };
    Reflect.defineMetadata(
      key,
      {
        '3:0': { index: 0, marker: 'parent' },
        '3:1': inheritedAtOne,
        '3:2': parentOnly,
      },
      Parent,
      'method',
    );
    Reflect.defineMetadata(
      key,
      { '3:0': ownAtZero, '3:1': inheritedAtOne, '3:2': parentOnly },
      Child,
      'method',
    );

    const result = getParamArgsMetadata(key, Child.prototype, 'method', 1);

    expect(Object.keys(result).sort()).toEqual(['3:0', '3:2']);
    expect(result['3:0']).toBe(ownAtZero);
    expect(result['3:2']).toBe(parentOnly);
  });

  it('supports a symbol method key', () => {
    const key = uniqueKey();
    const methodKey = Symbol('method');
    class Target {
      public method(_arg: unknown) {}
    }
    const entry = { index: 0 };
    Reflect.defineMetadata(key, { '3:0': entry }, Target, methodKey);

    expect(getParamArgsMetadata(key, Target.prototype, methodKey, 1)).toEqual({
      '3:0': entry,
    });
    expect(getParamArgsMetadata(key, Target.prototype, methodKey, 0)).toEqual({
      '3:0': entry,
    });
    expect(getParamArgsMetadata(key, Target.prototype, 'other', 0)).toEqual({});
  });
});
