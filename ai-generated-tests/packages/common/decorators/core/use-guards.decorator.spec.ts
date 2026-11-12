import { GUARDS_METADATA } from '../../../../../packages/common/constants.js';
import { UseGuards } from '../../../../../packages/common/decorators/core/use-guards.decorator.js';

describe('UseGuards', () => {
  it('stores guard classes and instances on a method', () => {
    class Guard {
      canActivate() {}
    }
    const instance = { canActivate() {} };
    class Target {
      method() {}
    }
    const descriptor = Object.getOwnPropertyDescriptor(
      Target.prototype,
      'method',
    )!;

    expect(UseGuards(Guard, instance)(Target.prototype, 'method', descriptor)).toBe(
      descriptor,
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, descriptor.value)).toEqual([
      Guard,
      instance,
    ]);
  });

  it('stores guards on a class target', () => {
    class Guard {
      canActivate() {}
    }
    class Target {}
    UseGuards(Guard)(Target);

    expect(Reflect.getMetadata(GUARDS_METADATA, Target)).toEqual([Guard]);
  });

  it('rejects invalid and falsy guards on methods and classes', () => {
    class Target {
      method() {}
    }
    const descriptor = Object.getOwnPropertyDescriptor(
      Target.prototype,
      'method',
    )!;

    expect(() =>
      UseGuards({} as any)(Target.prototype, 'method', descriptor),
    ).toThrow('Invalid guard passed to @UseGuards() decorator (Target).');
    expect(() => UseGuards(null as any)(Target)).toThrow(
      'Invalid guard passed to @UseGuards() decorator (Target).',
    );
    expect(() => UseGuards({} as any)(Target)).toThrow(
      'Invalid guard passed to @UseGuards() decorator (Target).',
    );
  });

  it('accumulates repeated applications', () => {
    class First {
      canActivate() {}
    }
    class Second {
      canActivate() {}
    }
    class Target {}
    UseGuards(First)(Target);
    UseGuards(Second)(Target);

    expect(Reflect.getMetadata(GUARDS_METADATA, Target)).toEqual([
      First,
      Second,
    ]);
  });
});
