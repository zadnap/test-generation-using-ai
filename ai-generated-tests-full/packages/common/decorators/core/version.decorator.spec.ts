import { describe, expect, it } from 'vitest';
import { VERSION_METADATA } from '../../../../../packages/common/constants.js';
import { Version } from '../../../../../packages/common/decorators/core/version.decorator.js';

describe('Version', () => {
  it('xc1(T): deduplicates an array of versions and returns the descriptor', () => {
    const descriptor = { value: () => undefined };

    const result = Version(['1', '1', '2'])(
      {},
      'handler',
      descriptor,
    );

    expect(result).toBe(descriptor);
    expect(Reflect.getMetadata(VERSION_METADATA, descriptor.value)).toEqual([
      '1',
      '2',
    ]);
  });

  it('xc1(F): stores a single string version unchanged', () => {
    const descriptor = { value: () => undefined };

    Version('1')({}, 'handler', descriptor);

    expect(Reflect.getMetadata(VERSION_METADATA, descriptor.value)).toBe('1');
  });

  it('xc1(F): stores a symbol version unchanged', () => {
    const descriptor = { value: () => undefined };
    const version = Symbol('v');

    Version(version)({}, 'handler', descriptor);

    expect(Reflect.getMetadata(VERSION_METADATA, descriptor.value)).toBe(
      version,
    );
  });
});
