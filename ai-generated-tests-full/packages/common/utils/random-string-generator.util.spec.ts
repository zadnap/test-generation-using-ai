import { describe, expect, it } from 'vitest';
import { randomStringGenerator } from '../../../../packages/common/utils/random-string-generator.util.js';

describe('randomStringGenerator', () => {
  it('generates a 21 character identifier', () => {
    const first = randomStringGenerator();
    const second = randomStringGenerator();
    expect(first).toHaveLength(21);
    expect(second).toHaveLength(21);
    expect(first).not.toBe(second);
  });
});
