import { describe, expect, it, vi } from 'vitest';
import { InstanceLinksHost } from '../../../../packages/core/injector/instance-links-host.js';
import { UnknownElementException } from '../../../../packages/core/errors/exceptions/unknown-element.exception.js';

function createModule(id: string, collections: any = {}) {
  return {
    id,
    providers: collections.providers ?? new Map(),
    injectables: collections.injectables ?? new Map(),
    controllers: collections.controllers ?? new Map(),
  } as any;
}

function createHost(modules: any[]) {
  return new InstanceLinksHost({
    getModules: () => new Map(modules.map(m => [m.id, m])),
  } as any);
}

describe('InstanceLinksHost', () => {
  it('xc1(T): throws for an unknown token', () => {
    const host = createHost([createModule('m')]);

    expect(() => host.get('missing')).toThrow(UnknownElementException);
  });

  it('xc1(F), xc2(T): returns every link when each is set', () => {
    const provider = { token: 'p' };
    const moduleA = createModule('a', {
      providers: new Map([['p', provider]]),
    });
    const moduleB = createModule('b', {
      providers: new Map([['p', provider]]),
    });
    const host = createHost([moduleA, moduleB]);

    expect(host.get('p', { each: true })).toHaveLength(2);
  });

  it('xc2(F), xc3(T): finds a link by module id', () => {
    const providerA = { token: 'a' };
    const providerB = { token: 'b' };
    const moduleA = createModule('a', {
      providers: new Map([['p', providerA]]),
    });
    const moduleB = createModule('b', {
      providers: new Map([['p', providerB]]),
    });
    const host = createHost([moduleA, moduleB]);

    expect(host.get('p', { moduleId: 'a' })).toMatchObject({
      wrapperRef: providerA,
      moduleId: 'a',
    });
  });

  it('xc3(F): throws when the module id has no link', () => {
    const moduleA = createModule('a', {
      providers: new Map([['p', { token: 'p' }]]),
    });
    const host = createHost([moduleA]);

    expect(() => host.get('p', { moduleId: 'missing' })).toThrow(
      UnknownElementException,
    );
  });

  it('xc4(T): returns the last link by default', () => {
    const providerA = { token: 'a' };
    const providerB = { token: 'b' };
    const moduleA = createModule('a', {
      providers: new Map([['p', providerA]]),
    });
    const moduleB = createModule('b', {
      providers: new Map([['p', providerB]]),
    });
    const host = createHost([moduleA, moduleB]);

    expect(host.get('p')).toMatchObject({ wrapperRef: providerB });
  });

  it('xc4(F): names function tokens in the error', () => {
    const host = createHost([createModule('m')]);
    class Missing {}

    expect(() => host.get(Missing)).toThrow(/Missing/);
  });

  it('indexes providers, injectables and controllers', () => {
    const provider = { token: 'provider' };
    const injectable = { token: 'injectable' };
    const controller = { token: 'controller' };
    const module = createModule('m', {
      providers: new Map([['provider', provider]]),
      injectables: new Map([['injectable', injectable]]),
      controllers: new Map([['controller', controller]]),
    });
    const host = createHost([module]);

    expect(host.get('provider').wrapperRef).toBe(provider);
    expect(host.get('injectable').wrapperRef).toBe(injectable);
    expect(host.get('controller').wrapperRef).toBe(controller);
  });

  it('uses string tokens in the error message', () => {
    const host = createHost([createModule('m')]);

    expect(() => host.get('missing')).toThrow(/missing/);
  });
});
