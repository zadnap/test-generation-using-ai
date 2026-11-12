import { describe, expect, it } from 'vitest';
import { RequestContextHost } from '../../../../packages/microservices/context/request-context-host.js';

/**
 * CFG / C3 decisions of RequestContextHost:
 * create / getData / getPattern / getContext are straight-line - no branches.
 */
describe('RequestContextHost', () => {
  describe('create', () => {
    // No decisions: builds a host around the three arguments.
    it('returns a host carrying the pattern, data and context', () => {
      const context = { getArgs: () => ['arg'] };

      const host = RequestContextHost.create('pattern', { id: 1 }, context);

      expect(host).toBeInstanceOf(RequestContextHost);
      expect(host.getPattern()).toBe('pattern');
      expect(host.getData()).toEqual({ id: 1 });
      expect(host.getContext()).toBe(context);
    });

    it('accepts an object pattern', () => {
      const pattern = { cmd: 'ping' };

      const host = RequestContextHost.create(pattern, 'data', {} as any);

      expect(host.getPattern()).toBe(pattern);
    });
  });

  describe('getData', () => {
    // No decisions: returns the data captured by the constructor.
    it('returns the data passed to the constructor', () => {
      const data = { value: 42 };
      const host = new RequestContextHost('p', data, {} as any);

      expect(host.getData()).toBe(data);
    });
  });

  describe('getPattern', () => {
    // No decisions: returns the pattern captured by the constructor.
    it('returns the pattern passed to the constructor', () => {
      const host = new RequestContextHost('users.findOne', null, {} as any);

      expect(host.getPattern()).toBe('users.findOne');
    });
  });

  describe('getContext', () => {
    // No decisions: returns the context captured by the constructor.
    it('returns the context passed to the constructor', () => {
      const context = { getArgs: () => [] };
      const host = new RequestContextHost('p', null, context);

      expect(host.getContext()).toBe(context);
    });
  });
});
