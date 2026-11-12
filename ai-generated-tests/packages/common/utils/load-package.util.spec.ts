import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadPackage,
  loadPackageCached,
  loadPackageSync,
  tryLoadPackage,
} from '../../../../packages/common/utils/load-package.util.js';
import { Logger } from '../../../../packages/common/services/logger.service.js';

let counter = 0;
const unique = (prefix: string) => `${prefix}-${Date.now()}-${counter++}`;

describe('load-package.util (C3)', () => {
  let errorSpy: any;
  let flushSpy: any;
  let exitSpy: any;

  beforeEach(() => {
    errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined as any);
    flushSpy = vi
      .spyOn(Logger, 'flush')
      .mockImplementation(() => undefined as any);
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadPackage', () => {
    it('loads through a loader function and caches the result', async () => {
      const name = unique('loadPackage-loader');
      const value = { value: true };
      const loader = vi.fn(async () => value);

      await expect(loadPackage(name, 'ctx', loader)).resolves.toBe(value);
      await expect(loadPackage(name, 'ctx', loader)).resolves.toBe(value);
      expect(loader).toHaveBeenCalledTimes(1);
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('loads a package with a dynamic import when no loader is given', async () => {
      const result: any = await loadPackage('node:path', 'ctx');
      expect(typeof result.join).toBe('function');
    });

    it('logs and exits when the loader rejects', async () => {
      const name = unique('loadPackage-fail');
      const loader = vi.fn(async () => {
        throw new Error('missing');
      });

      await expect(loadPackage(name, 'context', loader)).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(flushSpy).toHaveBeenCalledTimes(1);
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('loadPackageSync', () => {
    it('loads through a loader function and caches the result', () => {
      const name = unique('loadPackageSync-loader');
      const value = { value: true };
      const loader = vi.fn(() => value);

      expect(loadPackageSync(name, 'ctx', loader)).toBe(value);
      expect(loadPackageSync(name, 'ctx', vi.fn())).toBe(value);
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it('loads a package through createRequire when no loader is given', () => {
      const result = loadPackageSync('path', 'ctx');
      expect(typeof result.join).toBe('function');
    });

    it('logs and exits when the loader throws', () => {
      const name = unique('loadPackageSync-fail');
      const loader = () => {
        throw new Error('missing');
      };

      expect(loadPackageSync(name, 'context', loader)).toBeUndefined();
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(flushSpy).toHaveBeenCalledTimes(1);
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('loadPackageCached', () => {
    it('returns a cached package', () => {
      const name = unique('loadPackageCached-hit');
      const value = { value: true };
      loadPackageSync(name, 'ctx', () => value);

      expect(loadPackageCached(name)).toBe(value);
      expect(loadPackageCached(name, 'ctx')).toBe(value);
    });

    it('falls back to a synchronous load when context is provided', () => {
      const result = loadPackageCached('node:os', 'ctx');
      expect(typeof result.platform).toBe('function');
    });

    it('throws when the package is not cached and no context is provided', () => {
      const name = unique('loadPackageCached-miss');
      expect(() => loadPackageCached(name)).toThrowError(
        `Package "${name}" has not been loaded yet. Ensure loadPackage("${name}", ...) has been awaited before calling loadPackageCached.`,
      );
    });
  });

  describe('tryLoadPackage', () => {
    it('returns a cached package without calling the loader again', async () => {
      const name = unique('tryLoadPackage-cached');
      const value = { value: true };
      const loader = vi.fn(async () => value);

      await expect(tryLoadPackage(name, loader)).resolves.toBe(value);
      await expect(tryLoadPackage(name, vi.fn())).resolves.toBe(value);
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it('loads through a loader function', async () => {
      const name = unique('tryLoadPackage-loader');
      const value = { value: true };
      await expect(tryLoadPackage(name, async () => value)).resolves.toBe(
        value,
      );
    });

    it('returns null when the loader rejects', async () => {
      const name = unique('tryLoadPackage-fail');
      await expect(
        tryLoadPackage(name, async () => {
          throw new Error('missing');
        }),
      ).resolves.toBeNull();
    });

    it('loads a package with a dynamic import when no loader is given', async () => {
      const result: any = await tryLoadPackage('node:url');
      expect(typeof result.URL).toBe('function');
    });

    it('returns null when a dynamic import fails', async () => {
      await expect(tryLoadPackage(unique('tryLoadPackage-missing'))).resolves
        .toBeNull();
    });
  });
});
