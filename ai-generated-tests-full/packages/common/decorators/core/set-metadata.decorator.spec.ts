import { describe, expect, it } from 'vitest';
import { SetMetadata } from '../../../../../packages/common/decorators/core/set-metadata.decorator.js';

class Target {
  handler() {}
}

describe('SetMetadata', () => {
  it('xc1(T): attaches metadata to the method function and returns the descriptor', () => {
    const decorator = SetMetadata('roles', ['admin']);
    const descriptor = { value: () => undefined };

    const result = decorator(Target.prototype, 'handler', descriptor);

    expect(result).toBe(descriptor);
    expect(Reflect.getMetadata('roles', descriptor.value)).toEqual(['admin']);
    expect(decorator.KEY).toBe('roles');
  });

  it('xc1(F): attaches metadata to the class target and returns it', () => {
    const decorator = SetMetadata('scope', 'global');

    const result = decorator(Target);

    expect(result).toBe(Target);
    expect(Reflect.getMetadata('scope', Target)).toBe('global');
  });
});
