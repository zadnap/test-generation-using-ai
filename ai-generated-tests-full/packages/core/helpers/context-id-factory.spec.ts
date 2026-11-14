import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ContextIdFactory,
  createContextId,
} from '../../../../packages/core/helpers/context-id-factory.js';
import { REQUEST_CONTEXT_ID } from '../../../../packages/core/router/request/request-constants.js';

afterEach(() => {
  ContextIdFactory.apply(undefined as any);
});

describe('createContextId', () => {
  it('creates an object with a numeric id', () => {
    const contextId = createContextId();

    expect(typeof contextId.id).toBe('number');
  });
});

describe('ContextIdFactory', () => {
  it('xc1(T): creates a new context when the request is missing', () => {
    expect(ContextIdFactory.getByRequest(null as any)).toHaveProperty('id');
  });

  it('xc1(F), xc2(T): returns the context id stored on the request', () => {
    const contextId = { id: 1 };
    const request = { [REQUEST_CONTEXT_ID]: contextId };

    expect(ContextIdFactory.getByRequest(request)).toBe(contextId);
  });

  it('xc2(F), xc3(T): inspects the default raw property', () => {
    const contextId = { id: 2 };
    const request = { raw: { [REQUEST_CONTEXT_ID]: contextId } };

    expect(ContextIdFactory.getByRequest(request)).toBe(contextId);
  });

  it('xc3(F): inspects custom properties', () => {
    const contextId = { id: 3 };
    const request = { socket: { [REQUEST_CONTEXT_ID]: contextId } };

    expect(ContextIdFactory.getByRequest(request, ['socket'])).toBe(contextId);
  });

  it('xc4(T): creates a new context when no strategy is registered', () => {
    const request = {};

    expect(ContextIdFactory.getByRequest(request)).toHaveProperty('id');
  });

  it('xc4(F), xc5(T): attaches a resolver function as the parent', () => {
    const resolver = vi.fn(() => ({ id: 9 }));
    ContextIdFactory.apply({ attach: () => resolver });

    const contextId = ContextIdFactory.getByRequest({});

    expect(contextId.getParent).toBe(resolver);
  });

  it('xc5(F): attaches a resolver object with payload', () => {
    const resolve = vi.fn(() => ({ id: 9 }));
    ContextIdFactory.apply({
      attach: () => ({ resolve, payload: 'payload' }),
    });

    const contextId = ContextIdFactory.getByRequest({});

    expect(contextId.getParent).toBe(resolve);
    expect(contextId.payload).toBe('payload');
  });

  it('applies the strategy to subsequent requests', () => {
    const attach = vi.fn(() => undefined);
    ContextIdFactory.apply({ attach });

    ContextIdFactory.getByRequest({});

    expect(attach).toHaveBeenCalled();
  });
});
