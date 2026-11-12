import { HTTP_CODE_METADATA } from '../../../../../packages/common/constants.js';
import { HttpCode } from '../../../../../packages/common/decorators/http/http-code.decorator.js';

describe('HttpCode', () => {
  it('stores the status code on the method descriptor value', () => {
    class Target {
      method() {}
    }
    const descriptor = Object.getOwnPropertyDescriptor(
      Target.prototype,
      'method',
    )!;

    expect(HttpCode(204)(Target.prototype, 'method', descriptor)).toBe(
      descriptor,
    );
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, descriptor.value)).toBe(
      204,
    );
  });
});
