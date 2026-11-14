import { describe, expect, it } from 'vitest';
import {
  ASYNC_METHOD_SUFFIX,
  ASYNC_OPTIONS_METADATA_KEYS,
  CONFIGURABLE_MODULE_ID,
  DEFAULT_FACTORY_CLASS_METHOD_KEY,
  DEFAULT_METHOD_KEY,
} from '../../../../packages/common/module-utils/constants.js';

describe('module-utils constants', () => {
  it('exposes the documented values', () => {
    expect(DEFAULT_METHOD_KEY).toBe('register');
    expect(DEFAULT_FACTORY_CLASS_METHOD_KEY).toBe('create');
    expect(ASYNC_METHOD_SUFFIX).toBe('Async');
    expect(CONFIGURABLE_MODULE_ID).toBe('CONFIGURABLE_MODULE_ID');
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
