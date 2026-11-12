import { describe, expect, it } from 'vitest';
import { forwardRef } from '../../../../packages/common/utils/forward-ref.util.js';

describe('forwardRef (C3)', () => {
  it('wraps the callback in a forwardRef object', () => {
    const fn = () => 'value';
    const result = forwardRef(fn);

    expect(result.forwardRef).toBe(fn);
    expect(result.forwardRef()).toBe('value');
  });

  it('keeps the callback identity', () => {
    const fn = () => undefined;
    expect(forwardRef(fn).forwardRef).toBe(fn);
  });
});
