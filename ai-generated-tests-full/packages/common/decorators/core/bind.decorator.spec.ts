import { describe, expect, it, vi } from 'vitest';
import { Bind } from '../../../../../packages/common/decorators/core/bind.decorator.js';

describe('Bind', () => {
  it('calls every bound parameter decorator with its index and returns the descriptor', () => {
    const first = vi.fn();
    const second = vi.fn();
    const target = {};
    const descriptor = { value: () => undefined };

    const result = Bind(first, second)(target, 'handler', descriptor);

    expect(first).toHaveBeenCalledWith(target, 'handler', 0);
    expect(second).toHaveBeenCalledWith(target, 'handler', 1);
    expect(result).toBe(descriptor);
  });

  it('does nothing when no decorators are bound', () => {
    const target = {};
    const descriptor = { value: () => undefined };

    expect(Bind()(target, 'handler', descriptor)).toBe(descriptor);
  });
});
