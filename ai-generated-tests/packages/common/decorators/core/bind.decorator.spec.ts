import { Bind } from '../../../../../packages/common/decorators/core/bind.decorator.js';

describe('Bind', () => {
  it('invokes each parameter decorator with its positional index and returns the descriptor', () => {
    const first = vi.fn();
    const second = vi.fn();
    const target = {};
    const descriptor = { value: () => undefined };

    const result = Bind(first, second)(target, 'method', descriptor);

    expect(first).toHaveBeenCalledWith(target, 'method', 0);
    expect(second).toHaveBeenCalledWith(target, 'method', 1);
    expect(result).toBe(descriptor);
  });

  it('supports an empty decorator list', () => {
    const descriptor = { value: () => undefined };
    expect(Bind()({}, 'method', descriptor)).toBe(descriptor);
  });
});
