import { describe, expect, it } from 'vitest';
import {
  CATCH_WATERMARK,
  FILTER_CATCH_EXCEPTIONS,
} from '../../../../../packages/common/constants.js';
import { Catch } from '../../../../../packages/common/decorators/core/catch.decorator.js';

describe('Catch', () => {
  it('marks the class as a filter and stores the caught exception types', () => {
    class Filter {}
    class CustomError extends Error {}

    Catch(Error, CustomError)(Filter);

    expect(Reflect.getMetadata(CATCH_WATERMARK, Filter)).toBe(true);
    expect(Reflect.getMetadata(FILTER_CATCH_EXCEPTIONS, Filter)).toEqual([
      Error,
      CustomError,
    ]);
  });

  it('stores an empty exception list when called without arguments', () => {
    class Filter {}

    Catch()(Filter);

    expect(Reflect.getMetadata(FILTER_CATCH_EXCEPTIONS, Filter)).toEqual([]);
  });
});
