import { describe, expect, it } from 'vitest';
import { isLogLevel } from '../../../../../packages/common/services/utils/is-log-level.util.js';

describe('isLogLevel', () => {
  it.each([
    ['verbose', 'verbose', true],
    ['debug', 'debug', true],
    ['log', 'log', true],
    ['warn', 'warn', true],
    ['error', 'error', true],
    ['fatal', 'fatal', true],
    ['unknown', 'unknown', false],
    ['number', 1, false],
    ['undefined', undefined, false],
  ])('returns expected for %s', (_label, value, expected) => {
    expect(isLogLevel(value)).toBe(expected);
  });
});
