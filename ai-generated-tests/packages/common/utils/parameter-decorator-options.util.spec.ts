import { describe, expect, it } from 'vitest';
import { isParameterDecoratorOptions } from '../../../../packages/common/utils/parameter-decorator-options.util.js';

class Pipe {
  transform(value: unknown) {
    return value;
  }
}

describe('isParameterDecoratorOptions (C3)', () => {
  it.each([null, undefined, 0, '', false, NaN])(
    'returns false for the falsy value %s',
    value => {
      expect(isParameterDecoratorOptions(value)).toBe(false);
    },
  );

  it.each([
    ['an array', []],
    ['an empty object', {}],
    ['an object without schema or pipes', { other: true }],
    ['an object with a non-function transform', { transform: 1 }],
    ['an object with only unrelated keys', { pipe: [], schemaLike: {} }],
  ])('returns false for %s', (_label, value) => {
    expect(isParameterDecoratorOptions(value)).toBe(false);
  });

  it.each([
    ['schema', { schema: {} }],
    ['schema with undefined value', { schema: undefined }],
    ['pipes', { pipes: [] }],
    ['pipes with undefined value', { pipes: undefined }],
    ['both', { schema: {}, pipes: [] }],
  ])('returns true for %s', (_label, value) => {
    expect(isParameterDecoratorOptions(value)).toBe(true);
  });

  it('returns true when schema is inherited', () => {
    const value = Object.create({ schema: {} });
    expect(isParameterDecoratorOptions(value)).toBe(true);
  });

  it('returns true when pipes is inherited', () => {
    const value = Object.create({ pipes: [] });
    expect(isParameterDecoratorOptions(value)).toBe(true);
  });

  it('returns false for a pipe instance exposing a schema property', () => {
    const value = new Pipe() as any;
    value.schema = {};
    expect(isParameterDecoratorOptions(value)).toBe(false);
  });

  it('returns false for an object with a transform function and pipes', () => {
    const value = { transform: () => undefined, pipes: [] };
    expect(isParameterDecoratorOptions(value)).toBe(false);
  });

  it('returns false for a pipe class constructor', () => {
    expect(isParameterDecoratorOptions(Pipe)).toBe(false);
  });

  it('returns false for an object whose transform is inherited', () => {
    const value = Object.create({ transform: () => undefined });
    value.schema = {};
    expect(isParameterDecoratorOptions(value)).toBe(false);
  });
});
