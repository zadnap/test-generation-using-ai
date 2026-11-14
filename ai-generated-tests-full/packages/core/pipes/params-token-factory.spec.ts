import { describe, expect, it } from 'vitest';
import { RouteParamtypes } from '../../../../packages/common/enums/route-paramtypes.enum.js';
import { ParamsTokenFactory } from '../../../../packages/core/pipes/params-token-factory.js';

describe('ParamsTokenFactory', () => {
  const factory = new ParamsTokenFactory();

  it('xc1(T): maps BODY', () => {
    expect(factory.exchangeEnumForString(RouteParamtypes.BODY)).toBe('body');
  });

  it('xc1(F), xc2(T): maps PARAM', () => {
    expect(factory.exchangeEnumForString(RouteParamtypes.PARAM)).toBe('param');
  });

  it('xc2(F), xc3(T): maps QUERY', () => {
    expect(factory.exchangeEnumForString(RouteParamtypes.QUERY)).toBe('query');
  });

  it('xc3(F): falls back to custom', () => {
    expect(factory.exchangeEnumForString(RouteParamtypes.REQUEST)).toBe(
      'custom',
    );
  });
});
