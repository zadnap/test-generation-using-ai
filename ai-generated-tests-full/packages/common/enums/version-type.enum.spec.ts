import { describe, expect, it } from 'vitest';
import { VersioningType } from '../../../../packages/common/enums/version-type.enum.js';

describe('VersioningType', () => {
  it('assigns the expected numeric values', () => {
    expect(VersioningType.URI).toBe(0);
    expect(VersioningType.HEADER).toBe(1);
    expect(VersioningType.MEDIA_TYPE).toBe(2);
    expect(VersioningType.CUSTOM).toBe(3);
  });
});
