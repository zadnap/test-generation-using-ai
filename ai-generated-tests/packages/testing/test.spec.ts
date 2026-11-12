import { Test } from '../../../packages/testing/test.js';
import { TestingModuleBuilder } from '../../../packages/testing/testing-module.builder.js';

describe('Test', () => {
  describe('createTestingModule', () => {
    it.each([
      ['empty metadata', {}, undefined],
      ['metadata with providers', { providers: [] }, {}],
      [
        'options with module id generator',
        {},
        { moduleIdGeneratorAlgorithm: 'deep-hash' },
      ],
    ])('creates a builder for %s', (_label, metadata, options) => {
      const builder = Test.createTestingModule(metadata as any, options as any);

      expect(builder).toBeInstanceOf(TestingModuleBuilder);
    });
  });
});
