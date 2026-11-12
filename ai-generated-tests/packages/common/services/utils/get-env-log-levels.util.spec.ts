import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getEnvLogLevels,
  LOG_LEVEL_ENV_VAR,
} from '../../../../../packages/common/services/utils/get-env-log-levels.util.js';
import { LOG_LEVELS } from '../../../../../packages/common/services/log-levels.constant.js';

describe('getEnvLogLevels (C3)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    delete process.env[LOG_LEVEL_ENV_VAR];
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env[LOG_LEVEL_ENV_VAR];
  });

  it.each([undefined, '', ' ', '   '])(
    'returns undefined when the variable is %j',
    value => {
      if (value !== undefined) {
        vi.stubEnv(LOG_LEVEL_ENV_VAR, value);
      }
      expect(getEnvLogLevels()).toBeUndefined();
    },
  );

  it.each([
    ['warn', ['warn']],
    [' WARN ', ['warn']],
    ['warn,error', ['warn', 'error']],
    ['warn, error', ['warn', 'error']],
    ['>=warn', ['warn', 'error', 'fatal']],
    ['>warn', ['error', 'fatal']],
    ['>= warn', ['warn', 'error', 'fatal']],
    ['>WARN', ['error', 'fatal']],
    ['>=verbose', [...LOG_LEVELS]],
    ['>=fatal', ['fatal']],
  ])('parses %j', (value, expected) => {
    vi.stubEnv(LOG_LEVEL_ENV_VAR, value);
    expect(getEnvLogLevels()).toEqual(expected);
  });

  it.each(['nope', 'warn,nope', 'warn,', '>unknown', '>=unknown', '>', '>='])(
    'returns false when %j cannot be parsed',
    value => {
      vi.stubEnv(LOG_LEVEL_ENV_VAR, value);
      expect(getEnvLogLevels()).toBe(false);
    },
  );
});
