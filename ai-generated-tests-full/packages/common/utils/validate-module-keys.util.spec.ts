import { describe, expect, it } from 'vitest';
import { MODULE_METADATA } from '../../../../packages/common/constants.js';
import { validateModuleKeys } from '../../../../packages/common/utils/validate-module-keys.util.js';

describe('validateModuleKeys', () => {
  it.each([
    [MODULE_METADATA.IMPORTS],
    [MODULE_METADATA.EXPORTS],
    [MODULE_METADATA.CONTROLLERS],
    [MODULE_METADATA.PROVIDERS],
  ])('accepts the known key %s', key => {
    expect(() => validateModuleKeys([key])).not.toThrow();
  });

  it('accepts an empty list', () => {
    expect(() => validateModuleKeys([])).not.toThrow();
  });

  it('throws for the first unknown key', () => {
    expect(() => validateModuleKeys(['imports', 'unknown'])).toThrow(
      "Invalid property 'unknown' passed into the @Module() decorator.",
    );
  });
});
