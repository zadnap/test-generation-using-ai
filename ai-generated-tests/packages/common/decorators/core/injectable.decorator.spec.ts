import {
  INJECTABLE_WATERMARK,
  PARAMTYPES_METADATA,
  SCOPE_OPTIONS_METADATA,
} from '../../../../../packages/common/constants.js';
import {
  Injectable,
  mixin,
} from '../../../../../packages/common/decorators/core/injectable.decorator.js';

describe('Injectable', () => {
  it('marks a class as injectable with optional scope metadata', () => {
    class WithOptions {}
    class WithoutOptions {}
    Injectable({ scope: 'request' as any, durable: true })(WithOptions);
    Injectable()(WithoutOptions);

    expect(Reflect.getMetadata(INJECTABLE_WATERMARK, WithOptions)).toBe(true);
    expect(Reflect.getMetadata(SCOPE_OPTIONS_METADATA, WithOptions)).toEqual({
      scope: 'request',
      durable: true,
    });
    expect(Reflect.getMetadata(INJECTABLE_WATERMARK, WithoutOptions)).toBe(
      true,
    );
    expect(
      Reflect.getMetadata(SCOPE_OPTIONS_METADATA, WithoutOptions),
    ).toBeUndefined();
  });

  it('renames a mixin class and supplies empty paramtypes metadata', () => {
    class Mixin {}

    const result = mixin(Mixin);

    expect(result).toBe(Mixin);
    expect(Mixin.name).toHaveLength(21);
    expect(Reflect.getMetadata(INJECTABLE_WATERMARK, Mixin)).toBe(true);
    expect(Reflect.getMetadata(PARAMTYPES_METADATA, Mixin)).toEqual([]);
  });

  it('preserves existing paramtypes metadata on a mixin class', () => {
    class Dependency {}
    class Mixin {}
    Reflect.defineMetadata(PARAMTYPES_METADATA, [Dependency], Mixin);

    mixin(Mixin);

    expect(Reflect.getMetadata(PARAMTYPES_METADATA, Mixin)).toEqual([
      Dependency,
    ]);
  });
});
