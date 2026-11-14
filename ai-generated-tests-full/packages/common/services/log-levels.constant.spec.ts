import { describe, expect, it } from 'vitest';
import { LOG_LEVELS } from '../../../../packages/common/services/log-levels.constant.js';

describe('LOG_LEVELS', () => {
  it('lists the supported log levels in order', () => {
    expect(LOG_LEVELS).toEqual([
      'verbose',
      'debug',
      'log',
      'warn',
      'error',
      'fatal',
    ]);
  });
});
