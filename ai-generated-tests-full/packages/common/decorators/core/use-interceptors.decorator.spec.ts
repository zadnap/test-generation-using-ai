import { beforeEach, describe, expect, it } from 'vitest';
import { INTERCEPTORS_METADATA } from '../../../../../packages/common/constants.js';
import { UseInterceptors } from '../../../../../packages/common/decorators/core/use-interceptors.decorator.js';
import { InvalidDecoratorItemException } from '../../../../../packages/common/utils/validate-each.util.js';

class Target {
  handler() {}
}

beforeEach(() => {
  Reflect.deleteMetadata(INTERCEPTORS_METADATA, Target);
});

describe('UseInterceptors', () => {
  it('xc1(T): registers an interceptor class on a class target', () => {
    class Interceptor {}

    UseInterceptors(Interceptor)(Target);

    expect(Reflect.getMetadata(INTERCEPTORS_METADATA, Target)).toEqual([
      Interceptor,
    ]);
  });

  it('xc1(T): registers an interceptor instance exposing intercept()', () => {
    const interceptor = { intercept: () => undefined };

    UseInterceptors(interceptor as any)(Target);

    expect(Reflect.getMetadata(INTERCEPTORS_METADATA, Target)).toEqual([
      interceptor,
    ]);
  });

  it('xc2(T): registers interceptors on a method descriptor', () => {
    class Interceptor {}
    const descriptor = { value: () => undefined };

    const result = UseInterceptors(Interceptor)(
      Target.prototype,
      'handler',
      descriptor,
    );

    expect(result).toBe(descriptor);
    expect(
      Reflect.getMetadata(INTERCEPTORS_METADATA, descriptor.value),
    ).toEqual([Interceptor]);
  });

  it('xc2(F): rejects a truthy value that is neither a function nor exposes intercept()', () => {
    expect(() => UseInterceptors({} as any)(Target)).toThrow(
      InvalidDecoratorItemException,
    );
  });

  it('xc1(F): rejects a falsy interceptor', () => {
    expect(() => UseInterceptors(null as any)(Target)).toThrow(
      InvalidDecoratorItemException,
    );
  });

  it('rejects an invalid interceptor passed to a method', () => {
    expect(() =>
      UseInterceptors({} as any)(Target.prototype, 'handler', {
        value: () => undefined,
      }),
    ).toThrow(InvalidDecoratorItemException);
  });
});
