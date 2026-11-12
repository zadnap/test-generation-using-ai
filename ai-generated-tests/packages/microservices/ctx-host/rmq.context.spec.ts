import { describe, expect, it } from 'vitest';
import { RmqContext } from '../../../../packages/microservices/ctx-host/rmq.context.js';

/**
 * CFG / C3 decisions of RmqContext.getMetadata:
 * D1 args[0] defined (optional chaining)
 * D2 args[0].properties defined
 * D3 isObject(headers)
 * getMessage/getChannelRef/getPattern are straight-line getters.
 */
describe('RmqContext', () => {
  const channelRef = { ack: () => undefined };
  const pattern = 'orders.created';

  describe('getMessage', () => {
    // No decisions: returns tuple slot 0.
    it('returns the original RMQ message', () => {
      const message = {
        properties: { headers: {} },
        content: Buffer.from('x'),
      };

      expect(
        new RmqContext([message, channelRef, pattern] as any).getMessage(),
      ).toBe(message);
    });
  });

  describe('getChannelRef', () => {
    // No decisions: returns tuple slot 1.
    it('returns the channel reference', () => {
      expect(
        new RmqContext([{}, channelRef, pattern] as any).getChannelRef(),
      ).toBe(channelRef);
    });
  });

  describe('getPattern', () => {
    // No decisions: returns tuple slot 2.
    it('returns the pattern name', () => {
      expect(
        new RmqContext([{}, channelRef, pattern] as any).getPattern(),
      ).toBe(pattern);
    });
  });

  describe('getMetadata', () => {
    // D1(T)/D1(F), D2(T)/D2(F), D3(T)/D3(F) covered. No infeasible path.
    it('D1(T) D2(T) D3(T) - keeps only string header values', () => {
      const message = {
        properties: {
          headers: { tenant: 'acme', retries: 3, flags: ['a'] },
        },
      };

      expect(
        new RmqContext([message, channelRef, pattern] as any).getMetadata(),
      ).toEqual({ tenant: 'acme' });
    });

    it('D1(T) D2(T) D3(T) - returns undefined when no header value is a string', () => {
      const message = { properties: { headers: { retries: 3 } } };

      expect(
        new RmqContext([message, channelRef, pattern] as any).getMetadata(),
      ).toBeUndefined();
    });

    it('D1(T) D2(T) D3(F) - returns undefined when headers are not an object', () => {
      const message = { properties: { headers: 'not-an-object' } };

      expect(
        new RmqContext([message, channelRef, pattern] as any).getMetadata(),
      ).toBeUndefined();
    });

    it('D1(T) D2(F) - returns undefined when properties are missing', () => {
      expect(
        new RmqContext([
          { content: '' },
          channelRef,
          pattern,
        ] as any).getMetadata(),
      ).toBeUndefined();
    });

    it('D1(F) - returns undefined when there is no message', () => {
      expect(
        new RmqContext([undefined, channelRef, pattern] as any).getMetadata(),
      ).toBeUndefined();
    });
  });
});
