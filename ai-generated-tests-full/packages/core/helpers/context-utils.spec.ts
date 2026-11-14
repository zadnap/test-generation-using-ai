import { describe, expect, it, vi } from 'vitest';
import { PARAMTYPES_METADATA } from '../../../../packages/common/constants.js';
import { RESPONSE_PASSTHROUGH_METADATA } from '../../../../packages/common/constants.js';
import { ContextUtils } from '../../../../packages/core/helpers/context-utils.js';
import { ExecutionContextHost } from '../../../../packages/core/helpers/execution-context-host.js';

describe('ContextUtils', () => {
  const utils = new ContextUtils();

  it('maps a parameter key to its type', () => {
    expect(utils.mapParamType('3:0')).toBe('3');
  });

  it('reflects callback parameter types', () => {
    class Controller {}
    Reflect.defineMetadata(PARAMTYPES_METADATA, [String], Controller.prototype, 'handler');

    expect(
      utils.reflectCallbackParamtypes(new Controller() as any, 'handler'),
    ).toEqual([String]);
  });

  it('reflects callback metadata from the constructor', () => {
    class Controller {}
    Reflect.defineMetadata('meta', 'value', Controller, 'handler');

    expect(
      utils.reflectCallbackMetadata(new Controller() as any, 'handler', 'meta'),
    ).toBe('value');
  });

  it('reflects the response passthrough flag', () => {
    class Controller {}
    Reflect.defineMetadata(
      RESPONSE_PASSTHROUGH_METADATA,
      true,
      Controller,
      'handler',
    );

    expect(
      utils.reflectPassthrough(new Controller() as any, 'handler'),
    ).toBe(true);
  });

  it('xc1(T): computes the arguments length from the highest index', () => {
    const metadata = { a: { index: 0 }, b: { index: 2 } };

    expect(utils.getArgumentsLength(['a', 'b'], metadata)).toBe(3);
  });

  it('xc1(F): returns zero arguments for an empty key list', () => {
    expect(utils.getArgumentsLength([], {})).toBe(0);
  });

  it('creates a null-filled array of the requested length', () => {
    const array = utils.createNullArray(3);

    expect(array).toHaveLength(3);
    expect(array).toEqual([undefined, undefined, undefined]);
  });

  it('xc1(T): returns params unchanged when no paramtypes are given', () => {
    const params = [{ index: 0 } as any];

    expect(utils.mergeParamsMetatypes(params, undefined as any)).toBe(params);
  });

  it('xc1(F): merges the metatype for each parameter', () => {
    const params = [{ index: 0 }, { index: 1 }] as any[];

    expect(utils.mergeParamsMetatypes(params, [String, Number])).toEqual([
      { index: 0, metatype: String },
      { index: 1, metatype: Number },
    ]);
  });

  it('xc1(T): wraps a custom factory when it is a function', () => {
    const factory = vi.fn((data, context) => ({ data, context }));
    const contextFactory = vi.fn(() => 'context');

    const wrapped = utils.getCustomFactory(factory, 'data', contextFactory);

    expect(wrapped('arg')).toEqual({ data: 'data', context: 'context' });
    expect(contextFactory).toHaveBeenCalledWith(['arg']);
  });

  it('xc1(F): returns a null factory for non-functions', () => {
    const wrapped = utils.getCustomFactory(
      'not a function' as any,
      'data',
      vi.fn(),
    );

    expect(wrapped()).toBeNull();
  });

  it('xc1(T): builds a context with the instance constructor and type', () => {
    class Controller {}
    const callback = () => undefined;
    const contextFactory = utils.getContextFactory(
      'rpc',
      new Controller(),
      callback,
    );

    const context = contextFactory(['a', 'b']);

    expect(context).toBeInstanceOf(ExecutionContextHost);
    expect(context.getType()).toBe('rpc');
    expect(context.getClass()).toBe(Controller);
    expect(context.getHandler()).toBe(callback);
    expect(context.getArgs()).toEqual(['a', 'b']);
  });

  it('xc1(F): builds a context without an instance', () => {
    const contextFactory = utils.getContextFactory('http');

    expect(contextFactory([]).getClass()).toBeNull();
  });
});
