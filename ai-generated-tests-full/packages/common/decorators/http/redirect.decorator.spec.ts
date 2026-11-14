import { describe, expect, it } from 'vitest';
import { REDIRECT_METADATA } from '../../../../../packages/common/constants.js';
import { Redirect } from '../../../../../packages/common/decorators/http/redirect.decorator.js';

describe('Redirect', () => {
  it('stores an empty url and no status code by default', () => {
    const descriptor = { value: () => undefined };

    const result = Redirect()({}, 'handler', descriptor);

    expect(result).toBe(descriptor);
    expect(Reflect.getMetadata(REDIRECT_METADATA, descriptor.value)).toEqual({
      statusCode: undefined,
      url: '',
    });
  });

  it('stores a custom url and status code', () => {
    const descriptor = { value: () => undefined };

    Redirect('/login', 302)({}, 'handler', descriptor);

    expect(Reflect.getMetadata(REDIRECT_METADATA, descriptor.value)).toEqual({
      statusCode: 302,
      url: '/login',
    });
  });
});
