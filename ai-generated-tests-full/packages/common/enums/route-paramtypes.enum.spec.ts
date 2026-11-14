import { describe, expect, it } from 'vitest';
import { RouteParamtypes } from '../../../../packages/common/enums/route-paramtypes.enum.js';

describe('RouteParamtypes', () => {
  it('assigns the expected numeric values', () => {
    expect(RouteParamtypes.REQUEST).toBe(0);
    expect(RouteParamtypes.BODY).toBe(3);
    expect(RouteParamtypes.RAW_BODY).toBe(12);
    expect(RouteParamtypes.COOKIES).toBe(14);
    expect(RouteParamtypes.SIGNED_COOKIES).toBe(15);
  });
});
