import { describe, expect, it } from 'vitest';
import { isLogLevel } from '../../../../../packages/common/services/utils/is-log-level.util.js';
import { LOG_LEVELS } from '../../../../../packages/common/services/log-levels.constant.js';

describe('isLogLevel (C3)', () => {
  it.each([...LOG_LEVELS])('accepts %s', level => {
    expect(isLogLevel(level)).toBe(true);
  });

  it.each([undefined, null, '', 'LOG', 'unknown', 1, {}, [], () => undefined])(
    'rejects %s',
    value => {
      expect(isLogLevel(value)).toBe(false);
    },
  );
});
