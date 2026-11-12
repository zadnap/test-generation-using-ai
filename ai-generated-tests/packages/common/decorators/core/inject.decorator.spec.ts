import {
  PARAMTYPES_METADATA,
  PROPERTY_DEPS_METADATA,
  SELF_DECLARED_DEPS_METADATA,
} from '../../../../../packages/common/constants.js';
import { Inject } from '../../../../../packages/common/decorators/core/inject.decorator.js';

describe('Inject', () => {
  it('registers an explicit constructor token', () => {
    class Target {}
    Inject('TOKEN')(Target, undefined as any, 1);

    expect(Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, Target)).toEqual([
      { index: 1, param: 'TOKEN' },
    ]);
  });

  it('infers a constructor token from design:paramtypes when called without arguments', () => {
    class Dependency {}
    class Target {}
    Reflect.defineMetadata(PARAMTYPES_METADATA, [Dependency], Target);
    Inject()(Target, undefined as any, 0);

    expect(Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, Target)).toEqual([
      { index: 0, param: Dependency },
    ]);
  });

  it('falls back to design:type for properties and replaces a previous entry', () => {
    class Dependency {}
    class Target {}
    Reflect.defineMetadata('design:type', Dependency, Target.prototype, 'dep');

    Inject()(Target.prototype, 'dep', undefined);
    Inject('OTHER')(Target.prototype, 'dep', undefined);

    expect(Reflect.getMetadata(PROPERTY_DEPS_METADATA, Target)).toEqual([
      { key: 'dep', type: 'OTHER' },
    ]);
  });

  it('registers a property token explicitly and handles a missing paramtypes lookup', () => {
    class Target {}
    Inject('PROPERTY')(Target.prototype, 'first', undefined);
    Inject()(Target.prototype, 'second', undefined);

    expect(Reflect.getMetadata(PROPERTY_DEPS_METADATA, Target)).toEqual([
      { key: 'first', type: 'PROPERTY' },
      { key: 'second', type: undefined },
    ]);
  });

  it('appends multiple constructor dependencies', () => {
    class Target {}
    Inject('A')(Target, undefined as any, 0);
    Inject('B')(Target, undefined as any, 1);

    expect(Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, Target)).toEqual([
      { index: 0, param: 'A' },
      { index: 1, param: 'B' },
    ]);
  });
});
