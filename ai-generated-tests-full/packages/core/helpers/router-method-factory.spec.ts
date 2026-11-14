import { describe, expect, it, vi } from 'vitest';
import { RequestMethod } from '../../../../packages/common/enums/request-method.enum.js';
import {
  REQUEST_METHOD_MAP,
  RouterMethodFactory,
} from '../../../../packages/core/helpers/router-method-factory.js';

describe('RouterMethodFactory', () => {
  it('xc1(T): returns the method matching the request method', () => {
    const factory = new RouterMethodFactory();
    const get = vi.fn();
    const target = { get } as any;

    expect(factory.get(target, RequestMethod.GET)).toBe(get);
  });

  it('xc1(F): falls back to use when the method is missing', () => {
    const factory = new RouterMethodFactory();
    const use = vi.fn();
    const target = { use } as any;

    expect(factory.get(target, RequestMethod.GET)).toBe(use);
  });

  it('falls back to use for an unknown request method', () => {
    const factory = new RouterMethodFactory();
    const use = vi.fn();
    const target = { use } as any;

    expect(factory.get(target, 999 as any)).toBe(use);
  });

  it('maps every request method', () => {
    expect(REQUEST_METHOD_MAP[RequestMethod.GET]).toBe('get');
    expect(REQUEST_METHOD_MAP[RequestMethod.POST]).toBe('post');
    expect(REQUEST_METHOD_MAP[RequestMethod.QUERY]).toBe('query');
  });
});
