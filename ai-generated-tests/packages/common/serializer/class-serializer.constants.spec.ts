import { describe, expect, it } from 'vitest';
import { CLASS_SERIALIZER_OPTIONS } from '../../../../packages/common/serializer/class-serializer.constants.js';

describe('CLASS_SERIALIZER_OPTIONS', () => {
  it.each([['CLASS_SERIALIZER_OPTIONS', CLASS_SERIALIZER_OPTIONS, 'class_serializer:options']])(
    'exports the expected constant value for %s',
    (_name, value, expected) => {
      expect(value).toBe(expected);
    },
  );
});
