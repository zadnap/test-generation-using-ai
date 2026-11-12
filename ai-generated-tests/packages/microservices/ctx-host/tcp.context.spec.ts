import { describe, expect, it } from 'vitest';
import { TcpContext } from '../../../../packages/microservices/ctx-host/tcp.context.js';

/**
 * CFG / C3 decisions of TcpContext:
 * getSocketRef/getPattern are straight-line.
 * D1 getMetadata: args[2] present (T) vs absent (F); the optional slot is
 *    returned as-is.
 */
describe('TcpContext', () => {
  const socketRef = { write: () => undefined };
  const pattern = 'ping';

  describe('getSocketRef', () => {
    // No decisions: returns tuple slot 0.
    it('returns the underlying JSON socket', () => {
      expect(new TcpContext([socketRef, pattern] as any).getSocketRef()).toBe(
        socketRef,
      );
    });
  });

  describe('getPattern', () => {
    // No decisions: returns tuple slot 1.
    it('returns the pattern name', () => {
      expect(new TcpContext([socketRef, pattern] as any).getPattern()).toBe(
        pattern,
      );
    });
  });

  describe('getMetadata', () => {
    // D1(T)/D1(F) covered. No infeasible path.
    it('D1(T) - returns the metadata attached by the client', () => {
      const metadata = { traceId: 'tcp-1' };

      expect(
        new TcpContext([socketRef, pattern, metadata] as any).getMetadata(),
      ).toBe(metadata);
    });

    it('D1(F) - returns undefined when the packet carries no metadata', () => {
      expect(
        new TcpContext([socketRef, pattern] as any).getMetadata(),
      ).toBeUndefined();
    });
  });
});
