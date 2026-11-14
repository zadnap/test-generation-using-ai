import { describe, expect, it } from 'vitest';
import { ParseDatePipe } from '../../../../packages/common/pipes/parse-date.pipe.js';

const metadata = { type: 'query' } as any;
const fixed = new Date('2020-01-01T00:00:00.000Z');

describe('ParseDatePipe', () => {
  it('uses the default factory for nil values', () => {
    const pipe = new ParseDatePipe({ default: () => fixed, optional: true });
    expect(pipe.transform(undefined, metadata)).toBe(fixed);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
  ])('returns %s when optional and no default exists', (_label, value) => {
    expect(new ParseDatePipe({ optional: true }).transform(value)).toBe(value);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['empty string', ''],
  ])('rejects %s when not optional', (_label, value) => {
    expect(() => new ParseDatePipe().transform(value)).toThrow(
      'Validation failed (no Date provided)',
    );
  });

  it.each([
    ['ISO string', '2020-01-01T00:00:00.000Z'],
    ['timestamp number', fixed.getTime()],
    ['Date instance', new Date(fixed.getTime())],
  ])('parses %s', (_label, value) => {
    expect(new ParseDatePipe().transform(value).getTime()).toBe(fixed.getTime());
  });

  it.each([
    ['invalid string', 'not-a-date'],
    ['NaN number', Number.NaN],
    ['plain object', {}],
    ['boolean', true],
  ])('rejects %s', (_label, value) => {
    expect(() => new ParseDatePipe().transform(value)).toThrow(
      'Validation failed (invalid date format)',
    );
  });

  it('supports a custom exception factory', () => {
    const pipe = new ParseDatePipe({
      exceptionFactory: message => new Error(`custom:${message}`),
    });
    expect(() => pipe.transform(undefined)).toThrow(
      'custom:Validation failed (no Date provided)',
    );
  });
});
