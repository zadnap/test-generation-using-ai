import { PARAMTYPES_METADATA } from '../../../../../packages/common/constants.js';
import {
  Dependencies,
  flatten,
} from '../../../../../packages/common/decorators/core/dependencies.decorator.js';

describe('Dependencies', () => {
  it('flattens nested dependency arrays recursively', () => {
    class Target {}
    Dependencies(['a', ['b', ['c']]], 'd')(Target);

    expect(Reflect.getMetadata(PARAMTYPES_METADATA, Target)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
    expect(flatten(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('leaves a flat dependency list unchanged', () => {
    class Target {}
    Dependencies('a', 'b')(Target);

    expect(Reflect.getMetadata(PARAMTYPES_METADATA, Target)).toEqual([
      'a',
      'b',
    ]);
  });
});
