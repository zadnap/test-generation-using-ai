import { describe, expect, it } from 'vitest';
import * as CoreIndex from '../../../packages/core/index.js';
import '../../../packages/core/interfaces/index.js';
import '../../../packages/core/inspector/interfaces/serialized-graph-json.interface.js';
import '../../../packages/core/inspector/interfaces/enhancer-metadata-cache-entry.interface.js';
import '../../../packages/core/inspector/interfaces/serialized-graph-metadata.interface.js';
import '../../../packages/core/router/interfaces/resolver.interface.js';
import '../../../packages/core/router/interfaces/exceptions-filter.interface.js';

describe('Core Barrel Exports', () => {
  it('should export all public API', () => {
    expect(CoreIndex.NestFactory).toBeDefined();
  });
});
