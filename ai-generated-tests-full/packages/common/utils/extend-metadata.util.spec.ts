import { describe, expect, it } from 'vitest';
import {
  extendArrayMetadata,
  getParamArgsMetadata,
} from '../../../../packages/common/utils/extend-metadata.util.js';

const KEY = 'test:param-args';

describe('extend-metadata.util', () => {
  it('initializes metadata when none exists', () => {
    class Target {}
    extendArrayMetadata(KEY, ['a'], Target);
    expect(Reflect.getMetadata(KEY, Target)).toEqual(['a']);
  });

  it('appends to existing metadata', () => {
    class Target {}
    extendArrayMetadata(KEY, ['a'], Target);
    extendArrayMetadata(KEY, ['b', 'c'], Target);
    expect(Reflect.getMetadata(KEY, Target)).toEqual(['a', 'b', 'c']);
  });
});

describe('getParamArgsMetadata', () => {
  const methodKey = 'handler';

  it('returns an empty object when no metadata exists', () => {
    class Target {
      handler() {}
    }
    expect(
      getParamArgsMetadata(KEY, new Target(), methodKey, 0),
    ).toEqual({});
  });

  it('filters only the inherited entry at the overridden index', () => {
    const shared = { index: 0 };
    class Parent {
      handler() {}
    }
    class Child extends Parent {
      handler() {}
    }
    Reflect.defineMetadata(KEY, { inherited: shared }, Parent, methodKey);
    Reflect.defineMetadata(
      KEY,
      { inherited: shared, own: { index: 1 }, sameIndex: { index: 0 } },
      Child,
      methodKey,
    );

    expect(
      getParamArgsMetadata(KEY, new Child(), methodKey, 0),
    ).toEqual({ own: { index: 1 }, sameIndex: { index: 0 } });
  });

  it('keeps the inherited entry when the index differs', () => {
    const shared = { index: 0 };
    class Parent {
      handler() {}
    }
    class Child extends Parent {
      handler() {}
    }
    Reflect.defineMetadata(KEY, { inherited: shared }, Parent, methodKey);
    Reflect.defineMetadata(KEY, { inherited: shared }, Child, methodKey);

    expect(
      getParamArgsMetadata(KEY, new Child(), methodKey, 7),
    ).toEqual({ inherited: shared });
  });
});
