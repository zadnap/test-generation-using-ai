import { describe, expect, it } from 'vitest';
import {
  INVALID_MODULE_CONFIG_MESSAGE,
  validateModuleKeys,
} from '../../../../packages/common/utils/validate-module-keys.util.js';
import { MODULE_METADATA } from '../../../../packages/common/constants.js';

describe('validateModuleKeys (C3)', () => {
  it.each([
    [MODULE_METADATA.IMPORTS],
    [MODULE_METADATA.EXPORTS],
    [MODULE_METADATA.CONTROLLERS],
    [MODULE_METADATA.PROVIDERS],
  ])('accepts the metadata key %s', key => {
    expect(() => validateModuleKeys([key])).not.toThrow();
  });

  it('accepts all metadata keys together', () => {
    expect(() =>
      validateModuleKeys(Object.values(MODULE_METADATA)),
    ).not.toThrow();
  });

  it('accepts an empty key list', () => {
    expect(() => validateModuleKeys([])).not.toThrow();
  });

  it.each(['invalid', 'Imports', 'import', '', 'toString'])(
    'rejects the key %s',
    key => {
      expect(() => validateModuleKeys([key])).toThrowError(
        `Invalid property '${key}' passed into the @Module() decorator.`,
      );
    },
  );

  it('formats the invalid property message', () => {
    expect(INVALID_MODULE_CONFIG_MESSAGE`${'bad'}`).toBe(
      "Invalid property 'bad' passed into the @Module() decorator.",
    );
  });
});
