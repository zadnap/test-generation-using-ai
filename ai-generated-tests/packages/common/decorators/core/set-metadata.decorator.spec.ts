import { SetMetadata } from '../../../../../packages/common/decorators/core/set-metadata.decorator.js';

describe('SetMetadata', () => {
  it('stores metadata on a method and exposes the key', () => {
    class Target {
      method() {}
    }
    const descriptor = Object.getOwnPropertyDescriptor(
      Target.prototype,
      'method',
    )!;
    const decorator = SetMetadata('roles', ['admin']);

    expect(decorator.KEY).toBe('roles');
    expect(decorator(Target.prototype, 'method', descriptor)).toBe(descriptor);
    expect(Reflect.getMetadata('roles', descriptor.value)).toEqual(['admin']);
  });

  it('stores metadata on a class target when no descriptor is supplied', () => {
    class Target {}
    const decorator = SetMetadata('scope', 'global');

    expect(decorator(Target, undefined, undefined)).toBe(Target);
    expect(Reflect.getMetadata('scope', Target)).toBe('global');
  });
});
