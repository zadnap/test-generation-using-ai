import { PIPES_METADATA } from '../../../../../packages/common/constants.js';
import { UsePipes } from '../../../../../packages/common/decorators/core/use-pipes.decorator.js';

describe('UsePipes', () => {
  it('stores pipe classes and instances on a method', () => {
    class Pipe {
      transform() {}
    }
    const instance = { transform() {} };
    class Target {
      method() {}
    }
    const descriptor = Object.getOwnPropertyDescriptor(
      Target.prototype,
      'method',
    )!;

    expect(UsePipes(Pipe, instance)(Target.prototype, 'method', descriptor)).toBe(
      descriptor,
    );
    expect(Reflect.getMetadata(PIPES_METADATA, descriptor.value)).toEqual([
      Pipe,
      instance,
    ]);
  });

  it('stores pipes on a class target', () => {
    class Pipe {
      transform() {}
    }
    class Target {}
    UsePipes(Pipe)(Target);

    expect(Reflect.getMetadata(PIPES_METADATA, Target)).toEqual([Pipe]);
  });

  it('rejects invalid and falsy pipes on methods and classes', () => {
    class Target {
      method() {}
    }
    const descriptor = Object.getOwnPropertyDescriptor(
      Target.prototype,
      'method',
    )!;

    expect(() =>
      UsePipes({} as any)(Target.prototype, 'method', descriptor),
    ).toThrow('Invalid pipe passed to @UsePipes() decorator (Target).');
    expect(() => UsePipes(null as any)(Target)).toThrow(
      'Invalid pipe passed to @UsePipes() decorator (Target).',
    );
    expect(() => UsePipes({} as any)(Target)).toThrow(
      'Invalid pipe passed to @UsePipes() decorator (Target).',
    );
  });

  it('accumulates repeated applications', () => {
    class First {
      transform() {}
    }
    class Second {
      transform() {}
    }
    class Target {}
    UsePipes(First)(Target);
    UsePipes(Second)(Target);

    expect(Reflect.getMetadata(PIPES_METADATA, Target)).toEqual([
      First,
      Second,
    ]);
  });
});
