import { describe, expect, it } from 'vitest';
import { getParamArgsMetadata } from '../../../../packages/websockets/utils/get-param-args-metadata.util.js';

const key = 'args';

class Base {}
class Derived extends Base {}

const define = (target: object, args: Record<string, { index: number }>) =>
  Reflect.defineMetadata(key, args, target, 'handle');

describe('getParamArgsMetadata', () => {
  it('should return an empty object when no metadata exists', () => {
    expect(getParamArgsMetadata(key, Derived.prototype, 'handle', 0)).toEqual(
      {},
    );
  });

  it('should keep entries of other indexes', () => {
    define(Derived, { '0:0': { index: 0 }, '1:1': { index: 1 } });

    const result = getParamArgsMetadata(key, Derived.prototype, 'handle', 0);

    expect(result).toEqual({
      '0:0': { index: 0 },
      '1:1': { index: 1 },
    });
  });

  it('should drop an inherited entry for the same index', () => {
    const inherited = { index: 0 };
    define(Base, { '0:0': inherited });
    define(Derived, { '0:0': inherited, '1:1': { index: 1 } });

    const result = getParamArgsMetadata(key, Derived.prototype, 'handle', 0);

    expect(result).toEqual({ '1:1': { index: 1 } });
  });

  it('should keep a same-index entry that the parent does not define', () => {
    const own = { index: 0 };
    define(Derived, { '0:0': own });

    expect(getParamArgsMetadata(key, Derived.prototype, 'handle', 0)).toEqual({
      '0:0': own,
    });
  });

  it('should keep a same-index entry that differs from the inherited one', () => {
    define(Base, { '0:0': { index: 0 } });
    const own = { index: 0 };
    define(Derived, { '0:0': own });

    expect(getParamArgsMetadata(key, Derived.prototype, 'handle', 0)).toEqual({
      '0:0': own,
    });
  });
});
