import { describe, expect, it } from 'vitest';
import { RENDER_METADATA } from '../../../../../packages/common/constants.js';
import { Render } from '../../../../../packages/common/decorators/http/render.decorator.js';

describe('Render', () => {
  it('stores the template name and returns the descriptor', () => {
    const descriptor = { value: () => undefined };

    const result = Render('index')({}, 'handler', descriptor);

    expect(result).toBe(descriptor);
    expect(Reflect.getMetadata(RENDER_METADATA, descriptor.value)).toBe(
      'index',
    );
  });
});
