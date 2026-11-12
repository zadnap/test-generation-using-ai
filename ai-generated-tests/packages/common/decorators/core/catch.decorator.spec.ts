import {
  CATCH_WATERMARK,
  FILTER_CATCH_EXCEPTIONS,
} from '../../../../../packages/common/constants.js';
import { Catch } from '../../../../../packages/common/decorators/core/catch.decorator.js';

describe('Catch', () => {
  it('marks a filter and stores all caught exception types', () => {
    class ErrorFilter {}
    class OtherFilter {}

    Catch(Error, TypeError)(ErrorFilter);
    Catch()(OtherFilter);

    expect(Reflect.getMetadata(CATCH_WATERMARK, ErrorFilter)).toBe(true);
    expect(Reflect.getMetadata(FILTER_CATCH_EXCEPTIONS, ErrorFilter)).toEqual([
      Error,
      TypeError,
    ]);
    expect(Reflect.getMetadata(FILTER_CATCH_EXCEPTIONS, OtherFilter)).toEqual(
      [],
    );
  });
});
