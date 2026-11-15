import { describe, expect, it } from 'vitest';
import * as WsIndex from '../../../packages/websockets/index.js';
import '../../../packages/websockets/utils/index.js';

describe('WebSockets Barrel Exports', () => {
  it('should export all public API', () => {
    expect(WsIndex.WebSocketGateway).toBeDefined();
    expect(WsIndex.WebSocketServer).toBeDefined();
  });
});
