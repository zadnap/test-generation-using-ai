import { describe, expect, it } from 'vitest';
import { randomStringGenerator } from '../../../../packages/common/utils/random-string-generator.util.js';

describe('randomStringGenerator (C3)', () => {
  it('generates a 21-character hex string', () => {
    const value = randomStringGenerator();
    expect(value).toHaveLength(21);
    expect(value).toMatch(/^[0-9a-f]{21}$/);
  });

  it('generates different values across calls', () => {
    const values = new Set(
      Array.from({ length: 100 }, () => randomStringGenerator()),
    );
    expect(values.size).toBeGreaterThan(90);
  });
});
