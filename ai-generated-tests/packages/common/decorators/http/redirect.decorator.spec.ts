import { REDIRECT_METADATA } from '../../../../../packages/common/constants.js';
import { Redirect } from '../../../../../packages/common/decorators/http/redirect.decorator.js';

describe('Redirect', () => {
  it('uses defaults when no arguments are supplied', () => {
    class Target {
      method() {}
    }
    const descriptor = Object.getOwnPropertyDescriptor(
      Target.prototype,
      'method',
    )!;

    expect(Redirect()(Target.prototype, 'method', descriptor)).toBe(descriptor);
    expect(Reflect.getMetadata(REDIRECT_METADATA, descriptor.value)).toEqual({
      statusCode: undefined,
      url: '',
    });
  });

  it('stores the url and status code', () => {
    class Target {
      method() {}
    }
    const descriptor = Object.getOwnPropertyDescriptor(
      Target.prototype,
      'method',
    )!;

    Redirect('/next', 302)(Target.prototype, 'method', descriptor);

    expect(Reflect.getMetadata(REDIRECT_METADATA, descriptor.value)).toEqual({
      statusCode: 302,
      url: '/next',
    });
  });
});
