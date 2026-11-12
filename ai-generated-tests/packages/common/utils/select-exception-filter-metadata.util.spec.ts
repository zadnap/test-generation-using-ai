import { describe, expect, it } from 'vitest';
import { selectExceptionFilterMetadata } from '../../../../packages/common/utils/select-exception-filter-metadata.util.js';

class CustomError extends Error {}
class AnotherError extends Error {}

describe('selectExceptionFilterMetadata (C3)', () => {
  it('returns undefined when there are no filters', () => {
    expect(selectExceptionFilterMetadata([], new Error())).toBeUndefined();
  });

  it('returns a filter with no exception metatypes for any exception', () => {
    const filter = { exceptionMetatypes: [], func: () => undefined };
    expect(
      selectExceptionFilterMetadata([filter as any], new Error()),
    ).toBe(filter);
  });

  it('returns the first filter whose metatype matches', () => {
    const first = {
      exceptionMetatypes: [CustomError],
      func: () => undefined,
    };
    const second = {
      exceptionMetatypes: [AnotherError],
      func: () => undefined,
    };

    expect(
      selectExceptionFilterMetadata([first, second] as any, new CustomError()),
    ).toBe(first);
    expect(
      selectExceptionFilterMetadata([first, second] as any, new AnotherError()),
    ).toBe(second);
  });

  it('matches any metatype in the list', () => {
    const filter = {
      exceptionMetatypes: [CustomError, AnotherError],
      func: () => undefined,
    };
    const exception = new AnotherError();

    expect(selectExceptionFilterMetadata([filter] as any, exception)).toBe(
      filter,
    );
  });

  it('returns undefined when no metatype matches', () => {
    const filter = {
      exceptionMetatypes: [AnotherError],
      func: () => undefined,
    };
    expect(
      selectExceptionFilterMetadata([filter] as any, new CustomError()),
    ).toBeUndefined();
  });
});
