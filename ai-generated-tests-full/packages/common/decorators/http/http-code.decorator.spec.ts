import { describe, expect, it } from 'vitest';
import { HTTP_CODE_METADATA } from '../../../../../packages/common/constants.js';
import { HttpCode } from '../../../../../packages/common/decorators/http/http-code.decorator.js';

describe('HttpCode', () => {
  it('stores the status code and returns the descriptor', () => {
    const descriptor = { value: () => undefined };

    const result = HttpCode(201)({}, 'handler', descriptor);

    expect(result).toBe(descriptor);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, descriptor.value)).toBe(
      201,
    );
  });
});
