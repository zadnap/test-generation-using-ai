import { describe, expect, it } from 'vitest';
import { LOG_LEVELS } from '../../../../../packages/common/services/log-levels.constant.js';
import { filterLogLevels } from '../../../../../packages/common/services/utils/filter-log-levels.util.js';

describe('filterLogLevels', () => {
  it.each([
    ['empty input', '', LOG_LEVELS],
    ['single level', 'warn', ['warn']],
    ['single level with spaces and case', ' WARN ', ['warn']],
    ['comma-separated levels', 'warn,error', ['warn', 'error']],
    ['comma-separated with blanks', 'warn, ,error', ['warn', 'error']],
    ['unknown comma list', 'foo,bar', []],
    ['unknown single level', 'nope', LOG_LEVELS],
  ])('handles %s', (_label, input, expected) => {
    expect(filterLogLevels(input)).toEqual(expected);
  });

  it.each([
    ['threshold inclusive', '>=warn', ['warn', 'error', 'fatal']],
    ['threshold exclusive', '>warn', ['error', 'fatal']],
    ['threshold spaced', '>= warn', ['warn', 'error', 'fatal']],
    ['threshold at first level', '>=verbose', [...LOG_LEVELS]],
  ])('handles %s', (_label, input, expected) => {
    expect(filterLogLevels(input)).toEqual(expected);
  });

  it('throws for an unknown threshold', () => {
    expect(() => filterLogLevels('>=nope')).toThrow(
      'parse error (unknown log level): >=nope',
    );
  });
});
