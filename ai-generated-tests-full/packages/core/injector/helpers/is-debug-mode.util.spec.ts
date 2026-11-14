import { afterEach, describe, expect, it } from 'vitest';
import { isDebugMode } from '../../../../../packages/core/injector/helpers/is-debug-mode.util.js';

describe('isDebugMode', () => {
  const original = process.env.NEST_DEBUG;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NEST_DEBUG;
    } else {
      process.env.NEST_DEBUG = original;
    }
  });

  it('xc1(T): returns true when NEST_DEBUG is set', () => {
    process.env.NEST_DEBUG = '1';

    expect(isDebugMode()).toBe(true);
  });

  it('xc1(F): returns false when NEST_DEBUG is unset', () => {
    delete process.env.NEST_DEBUG;

    expect(isDebugMode()).toBe(false);
  });

  it('returns false for an empty value', () => {
    process.env.NEST_DEBUG = '';

    expect(isDebugMode()).toBe(false);
  });
});
