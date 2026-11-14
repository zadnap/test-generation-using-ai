import { beforeEach, describe, expect, it } from 'vitest';
import { GUARDS_METADATA } from '../../../../../packages/common/constants.js';
import { UseGuards } from '../../../../../packages/common/decorators/core/use-guards.decorator.js';
import { InvalidDecoratorItemException } from '../../../../../packages/common/utils/validate-each.util.js';

class Target {
  handler() {}
}

beforeEach(() => {
  Reflect.deleteMetadata(GUARDS_METADATA, Target);
});

describe('UseGuards', () => {
  it('xc1(T): registers a guard class on a class target', () => {
    class Guard {}

    UseGuards(Guard)(Target);

    expect(Reflect.getMetadata(GUARDS_METADATA, Target)).toEqual([Guard]);
  });

  it('xc1(T): registers a guard instance exposing canActivate()', () => {
    const guard = { canActivate: () => true };

    UseGuards(guard as any)(Target);

    expect(Reflect.getMetadata(GUARDS_METADATA, Target)).toEqual([guard]);
  });

  it('xc2(T): registers guards on a method descriptor', () => {
    class Guard {}
    const descriptor = { value: () => undefined };

    const result = UseGuards(Guard)(Target.prototype, 'handler', descriptor);

    expect(result).toBe(descriptor);
    expect(Reflect.getMetadata(GUARDS_METADATA, descriptor.value)).toEqual([
      Guard,
    ]);
  });

  it('xc2(F): rejects a truthy value that is neither a function nor exposes canActivate()', () => {
    expect(() => UseGuards({} as any)(Target)).toThrow(
      InvalidDecoratorItemException,
    );
  });

  it('xc1(F): rejects a falsy guard', () => {
    expect(() => UseGuards(null as any)(Target)).toThrow(
      InvalidDecoratorItemException,
    );
  });

  it('rejects an invalid guard passed to a method', () => {
    expect(() =>
      UseGuards({} as any)(Target.prototype, 'handler', {
        value: () => undefined,
      }),
    ).toThrow(InvalidDecoratorItemException);
  });
});
