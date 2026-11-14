import { describe, expect, it } from 'vitest';
import { selectExceptionFilterMetadata } from '../../../../packages/common/utils/select-exception-filter-metadata.util.js';

describe('selectExceptionFilterMetadata', () => {
  it('returns undefined for an empty filter list', () => {
    expect(selectExceptionFilterMetadata([], new Error('x'))).toBeUndefined();
  });

  it('selects a filter that matches every exception', () => {
    const filter = { exceptionMetatypes: [], func: () => undefined } as any;
    expect(selectExceptionFilterMetadata([filter], new Error('x'))).toBe(filter);
  });

  it('selects a filter whose metatype matches', () => {
    const filter = {
      exceptionMetatypes: [TypeError],
      func: () => undefined,
    } as any;
    expect(selectExceptionFilterMetadata([filter], new TypeError('x'))).toBe(
      filter,
    );
  });

  it('skips filters whose metatypes do not match and picks a later match', () => {
    const first = {
      exceptionMetatypes: [TypeError],
      func: () => undefined,
    } as any;
    const second = { exceptionMetatypes: [], func: () => undefined } as any;
    expect(selectExceptionFilterMetadata([first, second], new Error('x'))).toBe(
      second,
    );
  });

  it('returns undefined when nothing matches', () => {
    const filter = {
      exceptionMetatypes: [TypeError],
      func: () => undefined,
    } as any;
    expect(selectExceptionFilterMetadata([filter], new Error('x'))).toBeUndefined();
  });
});
