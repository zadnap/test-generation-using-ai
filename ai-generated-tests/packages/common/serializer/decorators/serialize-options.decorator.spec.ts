import { describe, expect, it, vi } from 'vitest';
import { SerializeOptions } from '../../../../../packages/common/serializer/decorators/serialize-options.decorator.js';
import { CLASS_SERIALIZER_OPTIONS } from '../../../../../packages/common/serializer/class-serializer.constants.js';

describe('SerializeOptions', () => {
  it('exposes the expected metadata key', () => {
    const decorator = SerializeOptions({});
    expect(decorator.KEY).toBe(CLASS_SERIALIZER_OPTIONS);
  });

  describe.each([
    ['empty object', {}],
    ['class-transformer options with groups', { groups: ['user'], excludeExtraneousValues: true }],
    [
      'standard-schema options',
      {
        schema: {
          '~standard': {
            version: 1,
            vendor: 'test-vendor',
            validate: vi.fn(),
          },
        },
        validateOptions: { libraryOptions: { strict: true } },
      },
    ],
    ['options with custom type', { type: class CustomType {} }],
  ])('metadata storage on target for %s', (_label, options) => {
    it('stores metadata on a class target', () => {
      class TargetClass {}
      const decorator = SerializeOptions(options as any);
      decorator(TargetClass);

      const metadata = Reflect.getMetadata(CLASS_SERIALIZER_OPTIONS, TargetClass);
      expect(metadata).toEqual(options);
    });

    it('stores metadata on a method target', () => {
      class TargetClass {
        handler() {}
      }
      const descriptor = Object.getOwnPropertyDescriptor(
        TargetClass.prototype,
        'handler',
      )!;
      const decorator = SerializeOptions(options as any);
      const returned = decorator(TargetClass.prototype, 'handler', descriptor);

      expect(returned).toBe(descriptor);
      const metadata = Reflect.getMetadata(
        CLASS_SERIALIZER_OPTIONS,
        descriptor.value,
      );
      expect(metadata).toEqual(options);
    });
  });
});
