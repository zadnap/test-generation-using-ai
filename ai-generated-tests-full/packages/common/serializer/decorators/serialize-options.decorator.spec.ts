import { describe, expect, it } from 'vitest';
import { SerializeOptions } from '../../../../../packages/common/serializer/decorators/serialize-options.decorator.js';
import { CLASS_SERIALIZER_OPTIONS } from '../../../../../packages/common/serializer/class-serializer.constants.js';

describe('SerializeOptions', () => {
  it('attaches the options as method metadata', () => {
    const options = { type: class Dto {} } as any;
    class Controller {
      @SerializeOptions(options)
      handler() {}
    }
    expect(
      Reflect.getMetadata(CLASS_SERIALIZER_OPTIONS, Controller.prototype.handler),
    ).toBe(options);
  });
});
