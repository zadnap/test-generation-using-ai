import { describe, expect, it } from 'vitest';
import { isLogLevelEnabled } from '../../../../../packages/common/services/utils/is-log-level-enabled.util.js';

describe('isLogLevelEnabled', () => {
  it.each([
    ['undefined list', 'log', undefined, false],
    ['empty list', 'log', [], false],
  ])('returns false for %s', (_label, level, levels, expected) => {
    expect(isLogLevelEnabled(level as any, levels as any)).toBe(expected);
  });

  it('returns true when the level is explicitly listed', () => {
    expect(isLogLevelEnabled('debug', ['debug'])).toBe(true);
  });

  it('treats the highest listed level as a threshold', () => {
    expect(isLogLevelEnabled('error', ['warn'])).toBe(true);
    expect(isLogLevelEnabled('log', ['warn'])).toBe(false);
  });

  it('keeps the highest level across an unsorted list', () => {
    expect(isLogLevelEnabled('fatal', ['error', 'verbose'])).toBe(true);
    expect(isLogLevelEnabled('debug', ['error', 'verbose'])).toBe(false);
  });
});
