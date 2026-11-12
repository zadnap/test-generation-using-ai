import { INTERCEPTORS_METADATA } from '../../../../../packages/common/constants.js';
import { UseInterceptors } from '../../../../../packages/common/decorators/core/use-interceptors.decorator.js';

describe('UseInterceptors', () => {
  it('stores interceptor classes and instances on a method', () => {
    class Interceptor {
      intercept() {}
    }
    const instance = { intercept() {} };
    class Target {
      method() {}
    }
    const descriptor = Object.getOwnPropertyDescriptor(
      Target.prototype,
      'method',
    )!;

    expect(
      UseInterceptors(Interceptor, instance)(
        Target.prototype,
        'method',
        descriptor,
      ),
    ).toBe(descriptor);
    expect(
      Reflect.getMetadata(INTERCEPTORS_METADATA, descriptor.value),
    ).toEqual([Interceptor, instance]);
  });

  it('stores interceptors on a class target', () => {
    class Interceptor {
      intercept() {}
    }
    class Target {}
    UseInterceptors(Interceptor)(Target);

    expect(Reflect.getMetadata(INTERCEPTORS_METADATA, Target)).toEqual([
      Interceptor,
    ]);
  });

  it('rejects invalid and falsy interceptors on methods and classes', () => {
    class Target {
      method() {}
    }
    const descriptor = Object.getOwnPropertyDescriptor(
      Target.prototype,
      'method',
    )!;

    expect(() =>
      UseInterceptors({} as any)(Target.prototype, 'method', descriptor),
    ).toThrow(
      'Invalid interceptor passed to @UseInterceptors() decorator (Target).',
    );
    expect(() => UseInterceptors(null as any)(Target)).toThrow(
      'Invalid interceptor passed to @UseInterceptors() decorator (Target).',
    );
    expect(() => UseInterceptors({} as any)(Target)).toThrow(
      'Invalid interceptor passed to @UseInterceptors() decorator (Target).',
    );
  });

  it('accumulates repeated applications', () => {
    class First {
      intercept() {}
    }
    class Second {
      intercept() {}
    }
    class Target {}
    UseInterceptors(First)(Target);
    UseInterceptors(Second)(Target);

    expect(Reflect.getMetadata(INTERCEPTORS_METADATA, Target)).toEqual([
      First,
      Second,
    ]);
  });
});
