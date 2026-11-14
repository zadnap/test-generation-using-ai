import { beforeEach, describe, expect, it } from 'vitest';
import {
  OPTIONAL_DEPS_METADATA,
  OPTIONAL_PROPERTY_DEPS_METADATA,
} from '../../../../../packages/common/constants.js';
import { Optional } from '../../../../../packages/common/decorators/core/optional.decorator.js';

class Target {}

beforeEach(() => {
  Reflect.deleteMetadata(OPTIONAL_PROPERTY_DEPS_METADATA, Target);
});

describe('Optional', () => {
  it('xc1(T): records a constructor parameter index', () => {
    const target = new Target();

    Optional()(target, 'constructor', 0);

    expect(Reflect.getMetadata(OPTIONAL_DEPS_METADATA, target)).toEqual([0]);
  });

  it('xc1(T): appends a constructor parameter index to the existing list', () => {
    const target = new Target();
    Reflect.defineMetadata(OPTIONAL_DEPS_METADATA, [0], target);

    Optional()(target, 'constructor', 1);

    expect(Reflect.getMetadata(OPTIONAL_DEPS_METADATA, target)).toEqual([
      0, 1,
    ]);
  });

  it('xc1(F): records a property key', () => {
    const target = new Target();

    Optional()(target, 'dependency');

    expect(
      Reflect.getMetadata(OPTIONAL_PROPERTY_DEPS_METADATA, Target),
    ).toEqual(['dependency']);
  });

  it('xc1(F): appends a property key to the existing list', () => {
    const target = new Target();
    Reflect.defineMetadata(OPTIONAL_PROPERTY_DEPS_METADATA, ['first'], Target);

    Optional()(target, 'second');

    expect(
      Reflect.getMetadata(OPTIONAL_PROPERTY_DEPS_METADATA, Target),
    ).toEqual(['first', 'second']);
  });
});
