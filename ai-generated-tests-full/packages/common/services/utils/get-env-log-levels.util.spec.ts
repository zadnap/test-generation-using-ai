import { afterEach, describe, expect, it } from 'vitest';
import {
  LOG_LEVEL_ENV_VAR,
  getEnvLogLevels,
} from '../../../../../packages/common/services/utils/get-env-log-levels.util.js';

const original = process.env[LOG_LEVEL_ENV_VAR];

const set = (value: string | undefined) => {
  if (value === undefined) {
    delete process.env[LOG_LEVEL_ENV_VAR];
  } else {
    process.env[LOG_LEVEL_ENV_VAR] = value;
  }
};

describe('getEnvLogLevels', () => {
  afterEach(() => set(original));

  it.each([
    ['unset', undefined, undefined],
    ['empty', '', undefined],
    ['blank', '   ', undefined],
  ])('returns undefined for %s values', (_label, value, expected) => {
    set(value);
    expect(getEnvLogLevels()).toBe(expected);
  });

  it.each([
    ['single level', 'warn', ['warn']],
    ['threshold inclusive', '>=warn', ['warn', 'error', 'fatal']],
    ['threshold exclusive', '>debug', ['log', 'warn', 'error', 'fatal']],
    ['list', 'warn,error', ['warn', 'error']],
    ['list with spaces', 'warn, error', ['warn', 'error']],
  ])('parses %s', (_label, value, expected) => {
    set(value);
    expect(getEnvLogLevels()).toEqual(expected);
  });

  it.each([
    ['unknown threshold', '>=nope'],
    ['unknown list entry', 'warn,nope'],
  ])('returns false for %s', (_label, value) => {
    set(value);
    expect(getEnvLogLevels()).toBe(false);
  });
});
