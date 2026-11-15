import { describe, expect, it } from 'vitest';
import * as WsIndex from '../../../packages/platform-ws/index.js';
import '../../../packages/platform-ws/adapters/index.js';

describe('Platform WS Barrel Exports', () => {
  it('should export all public API', () => {
    expect(WsIndex.WsAdapter).toBeDefined();
  });
});
