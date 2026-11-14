import { describe, expect, it } from 'vitest';
import { CLASS_SERIALIZER_OPTIONS } from '../../../../packages/common/serializer/class-serializer.constants.js';

describe('CLASS_SERIALIZER_OPTIONS', () => {
  it('uses the class serializer metadata key', () => {
    expect(CLASS_SERIALIZER_OPTIONS).toBe('class_serializer:options');
  });
});
