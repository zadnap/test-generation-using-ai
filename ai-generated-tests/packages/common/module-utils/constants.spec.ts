import { describe, expect, it } from 'vitest';
import {
  ASYNC_METHOD_SUFFIX,
  ASYNC_OPTIONS_METADATA_KEYS,
  CONFIGURABLE_MODULE_ID,
  DEFAULT_FACTORY_CLASS_METHOD_KEY,
  DEFAULT_METHOD_KEY,
} from '../../../../packages/common/module-utils/constants.js';

describe('module-utils constants', () => {
  it.each([
    ['DEFAULT_METHOD_KEY', DEFAULT_METHOD_KEY, 'register'],
    ['DEFAULT_FACTORY_CLASS_METHOD_KEY', DEFAULT_FACTORY_CLASS_METHOD_KEY, 'create'],
    ['ASYNC_METHOD_SUFFIX', ASYNC_METHOD_SUFFIX, 'Async'],
    ['CONFIGURABLE_MODULE_ID', CONFIGURABLE_MODULE_ID, 'CONFIGURABLE_MODULE_ID'],
  ])('exports expected string value for %s', (_name, value, expected) => {
    expect(value).toBe(expected);
  });

  it('exports expected ASYNC_OPTIONS_METADATA_KEYS', () => {
    expect(ASYNC_OPTIONS_METADATA_KEYS).toEqual([
      'useFactory',
      'useClass',
      'useExisting',
      'inject',
      'imports',
      'provideInjectionTokensFrom',
    ]);
  });
});
