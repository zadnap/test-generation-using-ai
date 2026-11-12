import { EXCEPTION_FILTERS_METADATA } from '../../../../../packages/common/constants.js';
import { UseFilters } from '../../../../../packages/common/decorators/core/exception-filters.decorator.js';

describe('UseFilters', () => {
  it('stores filters on a method and accepts class and instance filters', () => {
    class Filter {
      catch() {}
    }
    const instance = { catch() {} };
    class Target {
      method() {}
    }
    const descriptor = Object.getOwnPropertyDescriptor(
      Target.prototype,
      'method',
    )!;

    expect(UseFilters(Filter, instance)(Target.prototype, 'method', descriptor)).toBe(
      descriptor,
    );
    expect(
      Reflect.getMetadata(EXCEPTION_FILTERS_METADATA, descriptor.value),
    ).toEqual([Filter, instance]);
  });

  it('stores filters on a class target', () => {
    class Filter {
      catch() {}
    }
    class Target {}
    UseFilters(Filter)(Target);

    expect(Reflect.getMetadata(EXCEPTION_FILTERS_METADATA, Target)).toEqual([
      Filter,
    ]);
  });

  it('rejects invalid method and class filters, including falsy entries', () => {
    class Target {
      method() {}
    }
    const descriptor = Object.getOwnPropertyDescriptor(
      Target.prototype,
      'method',
    )!;

    expect(() =>
      UseFilters({} as any)(Target.prototype, 'method', descriptor),
    ).toThrow('Invalid filter passed to @UseFilters() decorator (Target).');
    expect(() => UseFilters({} as any)(Target)).toThrow(
      'Invalid filter passed to @UseFilters() decorator (Target).',
    );
    expect(() => UseFilters(null as any)(Target)).toThrow(
      'Invalid filter passed to @UseFilters() decorator (Target).',
    );
  });

  it('accumulates filters across repeated applications', () => {
    class First {
      catch() {}
    }
    class Second {
      catch() {}
    }
    class Target {}
    UseFilters(First)(Target);
    UseFilters(Second)(Target);

    expect(Reflect.getMetadata(EXCEPTION_FILTERS_METADATA, Target)).toEqual([
      First,
      Second,
    ]);
  });
});
