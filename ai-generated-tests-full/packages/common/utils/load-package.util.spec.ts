import { describe, expect, it } from 'vitest';
import {
  loadPackage,
  loadPackageCached,
  loadPackageSync,
  tryLoadPackage,
} from '../../../../packages/common/utils/load-package.util.js';

describe('load-package.util', () => {
  it('loads a package through the supplied loader and caches it', async () => {
    const loaded = await loadPackage('__cft_async__', 'tests', async () => ({
      name: 'loaded',
    }));
    expect(loaded).toEqual({ name: 'loaded' });

    const cached = await loadPackage('__cft_async__', 'tests', async () => {
      throw new Error('should not be called');
    });
    expect(cached).toEqual({ name: 'loaded' });
  });

  it('falls back to dynamic import when no loader is supplied', async () => {
    const pathModule = await loadPackage('node:path', 'tests');
    expect(typeof pathModule.join).toBe('function');
    expect(await loadPackage('node:path', 'tests')).toBe(pathModule);
  });

  it('loads synchronously through the supplied loader and caches it', () => {
    const loaded = loadPackageSync('__cft_sync__', 'tests', () => ({
      name: 'sync',
    }));
    expect(loaded).toEqual({ name: 'sync' });
    expect(loadPackageSync('__cft_sync__', 'tests')).toBe(loaded);
    expect(loadPackageCached('__cft_sync__')).toBe(loaded);
  });

  it('throws when loading from cache without a preloaded package', () => {
    expect(() => loadPackageCached('__cft_missing__')).toThrow(
      /has not been loaded yet/,
    );
  });

  it('tryLoadPackage returns the package and caches it', async () => {
    const loaded = await tryLoadPackage('__cft_try__', async () => ({
      name: 'try',
    }));
    expect(loaded).toEqual({ name: 'try' });
    expect(
      await tryLoadPackage('__cft_try__', async () => {
        throw new Error('should not be called');
      }),
    ).toBe(loaded);
  });

  it('tryLoadPackage returns null when the loader fails', async () => {
    expect(
      await tryLoadPackage('__cft_try_fail__', async () => {
        throw new Error('missing');
      }),
    ).toBeNull();
  });

  it('tryLoadPackage falls back to dynamic import and returns null on failure', async () => {
    expect(typeof (await tryLoadPackage('node:path')).join).toBe('function');
    expect(await tryLoadPackage('__cft_does_not_exist__')).toBeNull();
  });
});
