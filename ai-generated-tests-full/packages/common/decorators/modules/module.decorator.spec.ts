import { describe, expect, it } from 'vitest';
import { Module } from '../../../../../packages/common/decorators/modules/module.decorator.js';

describe('Module', () => {
  it('xc1(T): copies every valid own metadata property onto the class', () => {
    class Target {}
    const provider = class Provider {};
    const controller = class Controller {};

    Module({
      imports: [],
      providers: [provider],
      controllers: [controller],
      exports: [provider],
    })(Target);

    expect(Reflect.getMetadata('imports', Target)).toEqual([]);
    expect(Reflect.getMetadata('providers', Target)).toEqual([provider]);
    expect(Reflect.getMetadata('controllers', Target)).toEqual([controller]);
    expect(Reflect.getMetadata('exports', Target)).toEqual([provider]);
  });

  it('xc1(F): skips inherited properties that are not own properties', () => {
    class Target {}
    const metadata = Object.create({ imports: ['inherited'] });
    metadata.providers = ['own'];

    Module(metadata)(Target);

    expect(Reflect.getMetadata('imports', Target)).toBeUndefined();
    expect(Reflect.getMetadata('providers', Target)).toEqual(['own']);
  });

  it('rejects an unknown metadata key', () => {
    expect(() => Module({ unknown: [] } as any)).toThrow(
      "Invalid property 'unknown' passed into the @Module() decorator.",
    );
  });
});
