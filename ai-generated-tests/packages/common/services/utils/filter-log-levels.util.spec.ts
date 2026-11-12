import { describe, expect, it } from 'vitest';
import { filterLogLevels } from '../../../../../packages/common/services/utils/filter-log-levels.util.js';
import { LOG_LEVELS } from '../../../../../packages/common/services/log-levels.constant.js';

describe('filterLogLevels (C3)', () => {
  it('returns all levels when the argument is omitted', () => {
    expect(filterLogLevels()).toEqual([...LOG_LEVELS]);
  });

  it.each([
    ['', [...LOG_LEVELS]],
    ['   ', [...LOG_LEVELS]],
    ['unknown', [...LOG_LEVELS]],
    ['warn', ['warn']],
    [' WARN ', ['warn']],
    ['debug, warn', ['debug', 'warn']],
    ['debug,nope', ['debug']],
    ['nope,nope2', []],
    ['warn,', ['warn']],
  ])('parses %j as a single level or list', (input, expected) => {
    expect(filterLogLevels(input)).toEqual(expected);
  });

  it.each([
    ['>warn', ['error', 'fatal']],
    ['> warn', ['error', 'fatal']],
    ['>verbose', [...LOG_LEVELS.slice(1)]],
    ['>=warn', ['warn', 'error', 'fatal']],
    ['>= warn', ['warn', 'error', 'fatal']],
    ['>=verbose', [...LOG_LEVELS]],
    ['>=fatal', ['fatal']],
  ])('parses the threshold %j', (input, expected) => {
    expect(filterLogLevels(input)).toEqual(expected);
  });

  it.each(['>unknown', '>=unknown', '>', '>='])(
    'throws for the invalid threshold %j',
    input => {
      const sanitized = input.replaceAll(' ', '').toLowerCase();
      expect(() => filterLogLevels(input)).toThrowError(
        `parse error (unknown log level): ${sanitized}`,
      );
    },
  );
});
