import { describe, expect, it } from 'vitest';
import { generateOptionsInjectionToken } from '../../../../../packages/common/module-utils/utils/generate-options-injection-token.util.js';

describe('generateOptionsInjectionToken', () => {
  it('generates a token conforming to expected pattern', () => {
    const token = generateOptionsInjectionToken();
    expect(typeof token).toBe('string');
    expect(token).toMatch(/^CONFIGURABLE_MODULE_OPTIONS\[.+\]$/);
  });

  it('generates unique tokens on multiple calls', () => {
    const tokenA = generateOptionsInjectionToken();
    const tokenB = generateOptionsInjectionToken();
    expect(tokenA).not.toBe(tokenB);
  });
});
