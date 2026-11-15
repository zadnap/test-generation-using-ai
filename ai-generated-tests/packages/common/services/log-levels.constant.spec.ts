import { describe, expect, it } from 'vitest';
import { LOG_LEVELS } from '../../../../packages/common/services/log-levels.constant.js';

/**
 * `log-levels.constant.ts` has no decision node: `LOG_LEVELS` is a constant
 * tuple, so the module has exactly one independent path. The tests make sure
 * every element is evaluated in order and the array is usable as a level list.
 */
describe('LOG_LEVELS (C3: 0 decision nodes, 1 path)', () => {
  it('contains the supported levels in order', () => {
    expect(LOG_LEVELS).toEqual([
      'verbose',
      'debug',
      'log',
      'warn',
      'error',
      'fatal',
    ]);
  });

  it.each([
    [0, 'verbose'],
    [1, 'debug'],
    [2, 'log'],
    [3, 'warn'],
    [4, 'error'],
    [5, 'fatal'],
  ])('exposes index %i as %s', (index, expected) => {
    expect(LOG_LEVELS[index]).toBe(expected);
  });

  it('has no duplicated level', () => {
    expect(new Set(LOG_LEVELS).size).toBe(LOG_LEVELS.length);
  });
});
