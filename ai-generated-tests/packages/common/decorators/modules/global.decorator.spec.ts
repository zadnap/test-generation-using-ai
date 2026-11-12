import { GLOBAL_MODULE_METADATA } from '../../../../../packages/common/constants.js';
import { Global } from '../../../../../packages/common/decorators/modules/global.decorator.js';

describe('Global', () => {
  it('marks a module as global', () => {
    class Target {}
    Global()(Target);

    expect(Reflect.getMetadata(GLOBAL_MODULE_METADATA, Target)).toBe(true);
  });
});
