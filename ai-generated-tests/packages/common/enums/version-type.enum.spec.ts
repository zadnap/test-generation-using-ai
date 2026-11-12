import { describe, expect, it } from 'vitest';
import { VersioningType } from '../../../../packages/common/enums/version-type.enum.js';

const cases: [keyof typeof VersioningType, VersioningType][] = [
  ['URI', 0],
  ['HEADER', 1],
  ['MEDIA_TYPE', 2],
  ['CUSTOM', 3],
];

describe('VersioningType', () => {
  it.each(cases)('%s is %i', (name, value) => {
    expect(VersioningType[name]).toBe(value);
  });
});
