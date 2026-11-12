import { describe, expect, it } from 'vitest';
import { isStreamingBody } from '../../../../packages/common/utils/is-streaming-body.util.js';

function asyncIterable(extra: Record<string, unknown> = {}) {
  return {
    [Symbol.asyncIterator]: () => ({
      next: async () => ({ done: true, value: undefined }),
    }),
    ...extra,
  };
}

describe('isStreamingBody (C3)', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['number', 1],
    ['string', 'x'],
    ['boolean', false],
    ['symbol', Symbol('x')],
    ['function', () => undefined],
  ])('returns false for a non-object %s', (_label, value) => {
    expect(isStreamingBody(value)).toBe(false);
  });

  it.each([
    ['array', []],
    ['plain object', {}],
    ['thenable object', { then: () => undefined }],
    ['object with a non-function asyncIterator', { [Symbol.asyncIterator]: 1 }],
  ])('returns false for %s', (_label, value) => {
    expect(isStreamingBody(value)).toBe(false);
  });

  it('returns true for an async iterable without a then function', () => {
    expect(isStreamingBody(asyncIterable())).toBe(true);
  });

  it('returns true when then is present but not a function', () => {
    expect(isStreamingBody(asyncIterable({ then: 1 }))).toBe(true);
  });

  it('returns false for an async iterable that is also thenable', () => {
    expect(isStreamingBody(asyncIterable({ then: () => undefined }))).toBe(
      false,
    );
  });

  it('returns true for a Response instance', () => {
    expect(isStreamingBody(new Response('body'))).toBe(true);
  });

  it('returns true for an object exposing the Response toStringTag', () => {
    const value = { [Symbol.toStringTag]: 'Response' };
    expect(isStreamingBody(value)).toBe(true);
  });

  it('returns false for a thenable Response-like object without a Response tag', () => {
    const value = {
      [Symbol.toStringTag]: 'Custom',
      then: () => undefined,
    };
    expect(isStreamingBody(value)).toBe(false);
  });
});
