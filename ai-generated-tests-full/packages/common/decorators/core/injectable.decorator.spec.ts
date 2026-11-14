import { describe, expect, it } from 'vitest';
import {
  INJECTABLE_WATERMARK,
  PARAMTYPES_METADATA,
  SCOPE_OPTIONS_METADATA,
} from '../../../../../packages/common/constants.js';
import {
  Injectable,
  mixin,
} from '../../../../../packages/common/decorators/core/injectable.decorator.js';
import { Scope } from '../../../../../packages/common/interfaces/scope-options.interface.js';

describe('Injectable', () => {
  it('xc1(F): marks a class as injectable without scope options', () => {
    class Target {}

    Injectable()(Target);

    expect(Reflect.getMetadata(INJECTABLE_WATERMARK, Target)).toBe(true);
    expect(Reflect.getMetadata(SCOPE_OPTIONS_METADATA, Target)).toBeUndefined();
  });

  it('xc1(T): stores the provided scope options', () => {
    class Target {}

    Injectable({ scope: Scope.REQUEST })(Target);

    expect(Reflect.getMetadata(SCOPE_OPTIONS_METADATA, Target)).toEqual({
      scope: Scope.REQUEST,
    });
  });
});

describe('mixin', () => {
  it('xc1(T): renames the class and adds an empty parameter type list', () => {
    class Base {}

    const Mixed = mixin(Base);

    expect(Mixed).toBe(Base);
    expect(Mixed.name).toHaveLength(21);
    expect(Reflect.getMetadata(INJECTABLE_WATERMARK, Mixed)).toBe(true);
    expect(Reflect.getMetadata(PARAMTYPES_METADATA, Mixed)).toEqual([]);
  });

  it('xc1(F): preserves existing parameter type metadata', () => {
    class Base {}
    class Dependency {}
    Reflect.defineMetadata(PARAMTYPES_METADATA, [Dependency], Base);

    const Mixed = mixin(Base);

    expect(Reflect.getMetadata(PARAMTYPES_METADATA, Mixed)).toEqual([
      Dependency,
    ]);
  });
});
