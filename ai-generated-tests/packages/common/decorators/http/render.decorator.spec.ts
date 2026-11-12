import { RENDER_METADATA } from '../../../../../packages/common/constants.js';
import { Render } from '../../../../../packages/common/decorators/http/render.decorator.js';

describe('Render', () => {
  it('stores the template name on the method descriptor value', () => {
    class Target {
      method() {}
    }
    const descriptor = Object.getOwnPropertyDescriptor(
      Target.prototype,
      'method',
    )!;

    expect(Render('index')(Target.prototype, 'method', descriptor)).toBe(
      descriptor,
    );
    expect(Reflect.getMetadata(RENDER_METADATA, descriptor.value)).toBe(
      'index',
    );
  });
});
