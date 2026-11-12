import { VERSION_METADATA } from '../../../../../packages/common/constants.js';
import { Version } from '../../../../../packages/common/decorators/core/version.decorator.js';

describe('Version', () => {
  it('stores a scalar version on the method', () => {
    class Target {
      method() {}
    }
    const descriptor = Object.getOwnPropertyDescriptor(
      Target.prototype,
      'method',
    )!;

    expect(Version('1')(Target.prototype, 'method', descriptor)).toBe(
      descriptor,
    );
    expect(Reflect.getMetadata(VERSION_METADATA, descriptor.value)).toBe('1');
  });

  it('deduplicates array versions', () => {
    class Target {
      method() {}
    }
    const descriptor = Object.getOwnPropertyDescriptor(
      Target.prototype,
      'method',
    )!;

    Version(['1', '2', '1', '3', '2'])(Target.prototype, 'method', descriptor);

    expect(Reflect.getMetadata(VERSION_METADATA, descriptor.value)).toEqual([
      '1',
      '2',
      '3',
    ]);
  });
});
