import { describe, expect, it } from 'vitest';
import { isLogLevelEnabled } from '../../../../../packages/common/services/utils/is-log-level-enabled.util.js';
import type { LogLevel } from '../../../../../packages/common/services/log-levels.constant.js';

describe('isLogLevelEnabled (C3)', () => {
  it.each([undefined, []])('returns false for the levels %j', levels => {
    expect(isLogLevelEnabled('log', levels)).toBe(false);
  });

  it.each<[LogLevel, LogLevel[]]>([
    ['log', ['log']],
    ['debug', ['debug']],
    ['verbose', ['verbose']],
    ['warn', ['warn']],
    ['error', ['error']],
    ['fatal', ['fatal']],
    ['log', ['error', 'log']],
    ['debug', ['warn', 'debug']],
    ['fatal', ['verbose', 'fatal']],
  ])('returns true when %s is explicitly listed', (target, levels) => {
    expect(isLogLevelEnabled(target, levels)).toBe(true);
  });

  it.each<[LogLevel, LogLevel[]]>([
    ['log', ['warn', 'error']],
    ['verbose', ['warn']],
    ['debug', ['warn', 'error']],
    ['warn', ['error']],
    ['verbose', ['fatal']],
    ['log', ['fatal']],
  ])('returns false when %s is below the highest level', (target, levels) => {
    expect(isLogLevelEnabled(target, levels)).toBe(false);
  });

  it.each<[LogLevel, LogLevel[]]>([
    ['log', ['verbose', 'debug']],
    ['warn', ['verbose']],
    ['error', ['debug', 'log']],
    ['fatal', ['verbose', 'debug', 'log']],
  ])('returns true when %s is above the highest level', (target, levels) => {
    expect(isLogLevelEnabled(target, levels)).toBe(true);
  });

  it('keeps the highest value when levels are unordered', () => {
    expect(isLogLevelEnabled('log', ['error', 'warn', 'debug'])).toBe(false);
    expect(isLogLevelEnabled('warn', ['debug', 'error'])).toBe(false);
  });
});
