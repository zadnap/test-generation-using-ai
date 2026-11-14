import { describe, expect, it } from 'vitest';
import { generateOptionsInjectionToken } from '../../../../../packages/common/module-utils/utils/generate-options-injection-token.util.js';

describe('generateOptionsInjectionToken', () => {
  it('generates a unique token', () => {
    const first = generateOptionsInjectionToken();
    const second = generateOptionsInjectionToken();
    expect(first).toMatch(/^CONFIGURABLE_MODULE_OPTIONS\[[A-Za-z0-9]{21}\]$/);
    expect(first).not.toBe(second);
  });
});
