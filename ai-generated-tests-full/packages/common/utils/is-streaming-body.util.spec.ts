import { describe, expect, it } from 'vitest';
import { isStreamingBody } from '../../../../packages/common/utils/is-streaming-body.util.js';

const asyncIterable = {
  [Symbol.asyncIterator]: async function* () {
    yield 'a';
  },
};

const thenableAsyncIterable = {
  ...asyncIterable,
  then: () => undefined,
};

const taggedResponse = {
  [Symbol.toStringTag]: 'Response',
};

describe('isStreamingBody', () => {
  it.each([
    ['undefined', undefined, false],
    ['null', null, false],
    ['string', 'body', false],
    ['number', 1, false],
    ['plain object', {}, false],
    ['async iterable without then', asyncIterable, true],
    ['async iterable that is thenable', thenableAsyncIterable, false],
    ['non-iterable tagged as Response', taggedResponse, true],
    ['array with then property', Object.assign([], { then: () => undefined }), false],
    ['object with non-function async iterator', { [Symbol.asyncIterator]: 1 }, false],
  ])('classifies %s', (_label, value, expected) => {
    expect(isStreamingBody(value)).toBe(expected);
  });

  it('recognizes a real Response when the runtime provides one', () => {
    if (typeof Response === 'undefined') {
      return;
    }
    expect(isStreamingBody(new Response('body'))).toBe(true);
  });
});
