import { describe, expect, it, vi } from 'vitest';
import {
  createRequestClass,
} from '../../../../packages/platform-node/adapters/configured-request.js';
import { NodeRequest } from '../../../../packages/platform-node/adapters/node-request.js';

const makeReq = (RequestClass: typeof NodeRequest, init: any = {}) =>
  Object.assign(Object.create(RequestClass.prototype), {
    headers: {},
    url: '/',
    method: 'GET',
    socket: { remoteAddress: '127.0.0.1', encrypted: false },
    ...init,
  }) as NodeRequest;

// CFG (C3) of createRequestClass:
//   querystringParser !== undefined        T/F
//   typeof querystringParser !== 'function' T/F
//   trustProxy !== undefined && !== false  T/F
//   compileTrust: function / true / number / string / array
//   forwarded header present T/F; isFromTrustedProxy T/F
describe('createRequestClass', () => {
  it('should return NodeRequest itself without options', () => {
    expect(createRequestClass({})).toBe(NodeRequest);
    expect(createRequestClass({ trustProxy: false })).toBe(NodeRequest);
  });

  describe('querystringParser', () => {
    it('should reject a non-function parser', () => {
      expect(() =>
        createRequestClass({ querystringParser: 'nope' as any }),
      ).toThrow(TypeError);
    });

    it('should parse the query string with the custom parser', () => {
      const parser = vi.fn((query: string) =>
        Object.fromEntries(new URLSearchParams(query)),
      );
      const RequestClass = createRequestClass({ querystringParser: parser });
      const req = makeReq(RequestClass, { url: '/users?a=1&b=2' });
      expect(req.query).toEqual({ a: '1', b: '2' });
      expect(req.query).toBe(req.query);
      expect(parser).toHaveBeenCalledWith('a=1&b=2');
    });

    it('should call the parser with an empty string without a query', () => {
      const parser = vi.fn(() => ({ empty: true }));
      const RequestClass = createRequestClass({ querystringParser: parser });
      expect(makeReq(RequestClass, { url: '/users' }).query).toEqual({
        empty: true,
      });
      expect(parser).toHaveBeenCalledWith('');
    });

    it('should allow replacing the parsed query', () => {
      const RequestClass = createRequestClass({
        querystringParser: () => ({}),
      });
      const req = makeReq(RequestClass);
      req.query = { replaced: 1 };
      expect(req.query).toEqual({ replaced: 1 });
    });
  });

  describe('trustProxy', () => {
    it('should keep the base behavior when false', () => {
      expect(createRequestClass({ trustProxy: false })).toBe(NodeRequest);
    });

    it('should trust every proxy when true', () => {
      const RequestClass = createRequestClass({ trustProxy: true });
      const req = makeReq(RequestClass, {
        headers: {
          'x-forwarded-for': '1.1.1.1, 2.2.2.2',
          'x-forwarded-proto': 'https, http',
          'x-forwarded-host': 'example.com, proxy.local',
        },
      });
      expect(req.ip).toBe('1.1.1.1');
      expect(req.ips).toEqual(['1.1.1.1', '2.2.2.2']);
      expect(req.protocol).toBe('https');
      expect(req.hostname).toBe('example.com');
      expect(req.app.get('trust proxy')).toBe(true);
    });

    it('should trust no proxy for a hop count', () => {
      const RequestClass = createRequestClass({ trustProxy: 1 });
      const req = makeReq(RequestClass, {
        headers: { 'x-forwarded-proto': 'https' },
      });
      expect(req.ip).toBe('127.0.0.1');
      expect(req.protocol).toBe('http');
      expect(req.app.get('trust proxy')).toBe(1);
    });

    it('should use a custom trust function', () => {
      const trust = vi.fn(() => true);
      const RequestClass = createRequestClass({ trustProxy: trust });
      const req = makeReq(RequestClass, {
        headers: { 'x-forwarded-for': '9.9.9.9', 'x-forwarded-proto': 'https' },
      });
      expect(req.ip).toBe('9.9.9.9');
      expect(req.protocol).toBe('https');
      expect(trust).toHaveBeenCalledWith('127.0.0.1', 0);
    });

    it('should compile a string or array of proxy addresses', () => {
      const fromString = createRequestClass({ trustProxy: '127.0.0.1' });
      const fromArray = createRequestClass({ trustProxy: ['127.0.0.1'] });
      for (const RequestClass of [fromString, fromArray]) {
        const req = makeReq(RequestClass, {
          headers: { 'x-forwarded-proto': 'https' },
        });
        expect(req.protocol).toBe('https');
      }
    });

    it('should fall back to the Host header without forwarded host', () => {
      const RequestClass = createRequestClass({ trustProxy: true });
      const req = makeReq(RequestClass, { headers: { host: 'local:3000' } });
      expect(req.hostname).toBe('local');
    });

    it('should expose both trust proxy settings on app', () => {
      const RequestClass = createRequestClass({ trustProxy: true });
      const app = makeReq(RequestClass).app;
      expect(app.get('trust proxy fn')).toBeTypeOf('function');
      expect(app.get('other')).toBeUndefined();
      expect(app).toBe(makeReq(RequestClass).app);
    });

    it('should return undefined ip without a socket', () => {
      const RequestClass = createRequestClass({ trustProxy: true });
      const req = makeReq(RequestClass, { socket: undefined });
      expect(() => req.ip).toThrow();
    });
  });
});
