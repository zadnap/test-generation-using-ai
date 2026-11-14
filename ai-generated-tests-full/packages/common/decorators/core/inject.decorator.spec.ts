import { beforeEach, describe, expect, it } from 'vitest';
import {
  PARAMTYPES_METADATA,
  PROPERTY_DEPS_METADATA,
  SELF_DECLARED_DEPS_METADATA,
} from '../../../../../packages/common/constants.js';
import { Inject } from '../../../../../packages/common/decorators/core/inject.decorator.js';

class Target {}

beforeEach(() => {
  Reflect.deleteMetadata(PROPERTY_DEPS_METADATA, Target);
});

describe('Inject', () => {
  it('xc1(T): registers an explicit token for a property', () => {
    const target = new Target();

    Inject('TOKEN')(target, 'dependency');

    expect(
      Reflect.getMetadata(PROPERTY_DEPS_METADATA, Target),
    ).toEqual([{ key: 'dependency', type: 'TOKEN' }]);
  });

  it('xc1(F): infers the token from design:type for a property', () => {
    const target = new Target();
    class Service {}
    Reflect.defineMetadata('design:type', Service, target, 'dependency');

    Inject()(target, 'dependency');

    expect(
      Reflect.getMetadata(PROPERTY_DEPS_METADATA, Target),
    ).toEqual([{ key: 'dependency', type: Service }]);
  });

  it('xc2(T): infers the token from design:paramtypes for a constructor parameter', () => {
    const target = new Target();
    class Service {}
    Reflect.defineMetadata(
      PARAMTYPES_METADATA,
      [Service],
      target,
      'constructor',
    );

    Inject()(target, 'constructor', 0);

    expect(
      Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, target),
    ).toEqual([{ index: 0, param: Service }]);
  });

  it('xc2(F): uses an explicit token for a constructor parameter', () => {
    const target = new Target();

    Inject('TOKEN')(target, 'constructor', 1);

    expect(
      Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, target),
    ).toEqual([{ index: 1, param: 'TOKEN' }]);
  });

  it('xc3(T): appends to existing constructor dependencies', () => {
    const target = new Target();
    Reflect.defineMetadata(
      SELF_DECLARED_DEPS_METADATA,
      [{ index: 0, param: 'A' }],
      target,
    );

    Inject('B')(target, 'constructor', 1);

    expect(
      Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, target),
    ).toEqual([
      { index: 0, param: 'A' },
      { index: 1, param: 'B' },
    ]);
  });

  it('xc3(F): creates the constructor dependency list when none exists', () => {
    const target = new Target();

    Inject('A')(target, 'constructor', 0);

    expect(
      Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, target),
    ).toEqual([{ index: 0, param: 'A' }]);
  });

  it('xc4(T): replaces a previously registered property token', () => {
    const target = new Target();
    Inject('FIRST')(target, 'dependency');
    Reflect.defineMetadata(
      PROPERTY_DEPS_METADATA,
      [
        { key: 'dependency', type: 'FIRST' },
        { key: 'other', type: 'OTHER' },
      ],
      Target,
    );

    Inject('SECOND')(target, 'dependency');

    expect(
      Reflect.getMetadata(PROPERTY_DEPS_METADATA, Target),
    ).toEqual([
      { key: 'other', type: 'OTHER' },
      { key: 'dependency', type: 'SECOND' },
    ]);
  });

  it('xc4(F): creates the property dependency list when none exists', () => {
    const target = new Target();

    Inject('TOKEN')(target, 'dependency');

    expect(
      Reflect.getMetadata(PROPERTY_DEPS_METADATA, Target),
    ).toEqual([{ key: 'dependency', type: 'TOKEN' }]);
  });
});
