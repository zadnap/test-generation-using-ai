import { describe, expect, it } from 'vitest';
import { BaseRpcContext } from '../../../../packages/microservices/ctx-host/base-rpc.context.js';

/**
 * CFG / C3 decisions of BaseRpcContext:
 * No branches in this file: getArgs() and getArgByIndex() are straight-line.
 */
describe('BaseRpcContext', () => {
  describe('getArgs', () => {
    // No decisions: returns the tuple passed to the constructor.
    it('returns the exact args tuple reference', () => {
      const args: [string, number] = ['channel', 7];
      const context = new BaseRpcContext(args);

      expect(context.getArgs()).toBe(args);
    });

    it('returns an empty tuple unchanged', () => {
      const context = new BaseRpcContext([]);

      expect(context.getArgs()).toEqual([]);
    });
  });

  describe('getArgByIndex', () => {
    // No decisions: plain index lookup, including out-of-range indexes.
    it('returns the entry at the requested index', () => {
      const context = new BaseRpcContext(['first', 'second']);

      expect(context.getArgByIndex(0)).toBe('first');
      expect(context.getArgByIndex(1)).toBe('second');
    });

    it('returns undefined for an index outside the tuple', () => {
      const context = new BaseRpcContext(['only']);

      expect(context.getArgByIndex(3)).toBeUndefined();
      expect(context.getArgByIndex(-1)).toBeUndefined();
    });
  });
});
