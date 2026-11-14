import { beforeEach, describe, expect, it } from 'vitest';
import { EXCEPTION_FILTERS_METADATA } from '../../../../../packages/common/constants.js';
import { UseFilters } from '../../../../../packages/common/decorators/core/exception-filters.decorator.js';
import { InvalidDecoratorItemException } from '../../../../../packages/common/utils/validate-each.util.js';

class Target {
  handler() {}
}

beforeEach(() => {
  Reflect.deleteMetadata(EXCEPTION_FILTERS_METADATA, Target);
});

describe('UseFilters', () => {
  it('xc1(T): registers a filter class on a class target', () => {
    class Filter {}

    UseFilters(Filter)(Target);

    expect(
      Reflect.getMetadata(EXCEPTION_FILTERS_METADATA, Target),
    ).toEqual([Filter]);
  });

  it('xc1(T): registers a filter instance exposing catch()', () => {
    const filter = { catch: () => undefined };

    UseFilters(filter as any)(Target);

    expect(
      Reflect.getMetadata(EXCEPTION_FILTERS_METADATA, Target),
    ).toEqual([filter]);
  });

  it('xc2(T): registers filters on a method descriptor', () => {
    class Filter {}
    const descriptor = { value: () => undefined };

    const result = UseFilters(Filter)(Target.prototype, 'handler', descriptor);

    expect(result).toBe(descriptor);
    expect(
      Reflect.getMetadata(EXCEPTION_FILTERS_METADATA, descriptor.value),
    ).toEqual([Filter]);
  });

  it('xc2(F): rejects a truthy value that is neither a function nor exposes catch()', () => {
    expect(() => UseFilters({} as any)(Target)).toThrow(
      InvalidDecoratorItemException,
    );
  });

  it('xc1(F): rejects a falsy filter', () => {
    expect(() => UseFilters(null as any)(Target)).toThrow(
      InvalidDecoratorItemException,
    );
  });

  it('rejects an invalid filter passed to a method', () => {
    expect(() =>
      UseFilters({} as any)(Target.prototype, 'handler', {
        value: () => undefined,
      }),
    ).toThrow(InvalidDecoratorItemException);
  });
});
