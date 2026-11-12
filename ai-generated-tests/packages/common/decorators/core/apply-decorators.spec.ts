import { applyDecorators } from '../../../../../packages/common/decorators/core/apply-decorators.js';

describe('applyDecorators', () => {
  it('applies every decorator as a class decorator when no descriptor is provided', () => {
    const first = vi.fn();
    const second = vi.fn();
    class Target {}

    applyDecorators(first, second)(Target);

    expect(first).toHaveBeenCalledWith(Target);
    expect(second).toHaveBeenCalledWith(Target);
  });

  it('applies every decorator as a method decorator when a descriptor is provided', () => {
    const first = vi.fn();
    const second = vi.fn();
    class Target {
      method() {}
    }
    const descriptor = Object.getOwnPropertyDescriptor(Target.prototype, 'method')!;

    applyDecorators(first, second)(Target, 'method', descriptor);

    expect(first).toHaveBeenCalledWith(Target, 'method', descriptor);
    expect(second).toHaveBeenCalledWith(Target, 'method', descriptor);
  });

  it('applies decorators to a non-function target with a falsy descriptor through the method path', () => {
    const decorator = vi.fn();
    const target = {};

    applyDecorators(decorator)(target, 'key', undefined as any);

    expect(decorator).toHaveBeenCalledWith(target, 'key', undefined);
  });
});
