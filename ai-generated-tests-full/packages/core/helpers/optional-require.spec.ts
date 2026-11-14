import { describe, expect, it, vi } from 'vitest';
import { optionalRequire } from '../../../../packages/core/helpers/optional-require.js';

describe('optionalRequire', () => {
  it('xc1(T): returns the result of the loader function', async () => {
    const loader = vi.fn(async () => 'module');

    await expect(optionalRequire('package', loader)).resolves.toBe('module');
    expect(loader).toHaveBeenCalled();
  });

  it('xc1(F): imports the package when no loader is given', async () => {
    await expect(optionalRequire('node:path')).resolves.toBeTypeOf('object');
  });

  it('returns an empty object when the package cannot be loaded', async () => {
    await expect(
      optionalRequire('package', async () => {
        throw new Error('missing');
      }),
    ).resolves.toEqual({});
  });
});
