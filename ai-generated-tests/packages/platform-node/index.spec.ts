import { describe, expect, it } from 'vitest';
import * as NodeIndex from '../../../packages/platform-node/index.js';
import '../../../packages/platform-node/adapters/index.js';
import '../../../packages/platform-node/interfaces/index.js';
import '../../../packages/platform-node/multer/index.js';
import '../../../packages/platform-node/multer/interceptors/index.js';
import '../../../packages/platform-node/multer/interfaces/index.js';

describe('Platform Node Barrel Exports', () => {
  it('should export all public API', () => {
    expect(NodeIndex.NodeAdapter).toBeDefined();
  });
});
