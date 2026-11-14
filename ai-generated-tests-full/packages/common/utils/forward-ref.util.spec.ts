import { describe, expect, it } from 'vitest';
import { forwardRef } from '../../../../packages/common/utils/forward-ref.util.js';

describe('forwardRef', () => {
  it('wraps the callback in a forward reference', () => {
    const fn = () => 'value';
    const reference = forwardRef(fn);
    expect(reference.forwardRef).toBe(fn);
    expect(reference.forwardRef()).toBe('value');
  });
});
