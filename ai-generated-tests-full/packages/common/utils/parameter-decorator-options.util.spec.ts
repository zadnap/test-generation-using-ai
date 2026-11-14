import { describe, expect, it } from 'vitest';
import { isParameterDecoratorOptions } from '../../../../packages/common/utils/parameter-decorator-options.util.js';

class PipeClass {
  transform(value: unknown) {
    return value;
  }
}

class PlainClass {}

const pipeInstance = {
  transform(value: unknown) {
    return value;
  },
};

describe('isParameterDecoratorOptions', () => {
  it.each([
    ['null', null, false],
    ['undefined', undefined, false],
    ['string', 'options', false],
    ['number', 1, false],
    ['pipe instance', pipeInstance, false],
    ['pipe class', PipeClass, false],
    ['pipe instance with schema', { ...pipeInstance, schema: {} }, false],
    ['plain object', {}, false],
    ['object with schema', { schema: {} }, true],
    ['object with pipes', { pipes: [] }, true],
    ['object with non-function transform and pipes', { transform: 1, pipes: [] }, true],
    ['function without transform', Object.assign(() => undefined, { pipes: [] }), false],
    ['class without transform', PlainClass, false],
  ])('classifies %s', (_label, value, expected) => {
    expect(isParameterDecoratorOptions(value)).toBe(expected);
  });
});
