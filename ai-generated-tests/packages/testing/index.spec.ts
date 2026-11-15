import { describe, expect, it } from 'vitest';
import * as TestingIndex from '../../../packages/testing/index.js';
import '../../../packages/testing/interfaces/index.js';
import '../../../packages/testing/interfaces/override-by.interface.js';
import '../../../packages/testing/interfaces/override-module.interface.js';

describe('Testing Barrel Exports', () => {
  it('should export all public API', () => {
    expect(TestingIndex.Test).toBeDefined();
    expect(TestingIndex.TestingModule).toBeDefined();
    expect(TestingIndex.TestingModuleBuilder).toBeDefined();
  });
});
