import { HEADERS_METADATA } from '../../../../../packages/common/constants.js';
import { Header } from '../../../../../packages/common/decorators/http/header.decorator.js';

describe('Header', () => {
  it('accumulates response headers on the method descriptor value', () => {
    class Target {
      method() {}
    }
    const descriptor = Object.getOwnPropertyDescriptor(
      Target.prototype,
      'method',
    )!;
    const value = () => 'none';

    expect(Header('Cache-Control', 'no-store')(Target.prototype, 'method', descriptor)).toBe(
      descriptor,
    );
    Header('X-Test', value)(Target.prototype, 'method', descriptor);

    expect(Reflect.getMetadata(HEADERS_METADATA, descriptor.value)).toEqual([
      { name: 'Cache-Control', value: 'no-store' },
      { name: 'X-Test', value },
    ]);
  });
});
