import {
  OPTIONAL_DEPS_METADATA,
  OPTIONAL_PROPERTY_DEPS_METADATA,
} from '../../../../../packages/common/constants.js';
import { Optional } from '../../../../../packages/common/decorators/core/optional.decorator.js';

describe('Optional', () => {
  it('records parameter indexes', () => {
    class Target {}
    Optional()(Target, undefined as any, 1);
    Optional()(Target, undefined as any, 3);

    expect(Reflect.getMetadata(OPTIONAL_DEPS_METADATA, Target)).toEqual([1, 3]);
  });

  it('records property keys', () => {
    class Target {}
    Optional()(Target.prototype, 'first', undefined);
    Optional()(Target.prototype, 'second', undefined);

    expect(
      Reflect.getMetadata(OPTIONAL_PROPERTY_DEPS_METADATA, Target),
    ).toEqual(['first', 'second']);
  });
});
