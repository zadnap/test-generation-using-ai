import { Module } from '../../../../../packages/common/decorators/modules/module.decorator.js';

describe('Module', () => {
  it('stores every own metadata key on the target', () => {
    class Imported {}
    class Provider {}
    class Controller {}
    class Target {}

    Module({
      imports: [Imported],
      providers: [Provider],
      controllers: [Controller],
      exports: [Provider],
    })(Target);

    expect(Reflect.getMetadata('imports', Target)).toEqual([Imported]);
    expect(Reflect.getMetadata('providers', Target)).toEqual([Provider]);
    expect(Reflect.getMetadata('controllers', Target)).toEqual([Controller]);
    expect(Reflect.getMetadata('exports', Target)).toEqual([Provider]);
  });

  it('rejects invalid own metadata properties', () => {
    expect(() => Module({ invalid: true } as any)).toThrow(
      "Invalid property 'invalid' passed into the @Module() decorator.",
    );
  });

  it('skips inherited enumerable metadata properties', () => {
    class Target {}
    const metadata = Object.create({ imports: ['inherited'] });
    metadata.providers = ['own'];

    Module(metadata)(Target);

    expect(Reflect.getMetadata('imports', Target)).toBeUndefined();
    expect(Reflect.getMetadata('providers', Target)).toEqual(['own']);
  });
});
