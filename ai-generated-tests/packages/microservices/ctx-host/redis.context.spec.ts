import { describe, expect, it } from 'vitest';
import { RedisContext } from '../../../../packages/microservices/ctx-host/redis.context.js';

/**
 * CFG / C3 decisions of RedisContext:
 * getChannel is straight-line.
 * D1 getMetadata: args[1] present (T) vs absent (F); the optional slot is
 *    returned as-is.
 */
describe('RedisContext', () => {
  const channel = 'notifications';

  describe('getChannel', () => {
    // No decisions: returns tuple slot 0.
    it('returns the channel name', () => {
      expect(new RedisContext([channel] as any).getChannel()).toBe(channel);
    });
  });

  describe('getMetadata', () => {
    // D1(T)/D1(F) covered. No infeasible path.
    it('D1(T) - returns the packet metadata attached by the client', () => {
      const metadata = { tenant: 'acme' };

      expect(new RedisContext([channel, metadata] as any).getMetadata()).toBe(
        metadata,
      );
    });

    it('D1(F) - returns undefined when the packet carries no metadata', () => {
      expect(new RedisContext([channel] as any).getMetadata()).toBeUndefined();
    });
  });
});
