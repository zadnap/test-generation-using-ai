/**
 * CFT checklist extracted from packages/core/pipes/params-token-factory.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * ParamsTokenFactory.exchangeEnumForString @L5 - D=3, P=4.
 *   1=case RouteParamtypes.BODY
 *   2=case RouteParamtypes.PARAM
 *   3=case RouteParamtypes.QUERY
 */
import { describe, it } from 'vitest';
import { RouteParamtypes } from '@nestjs/common/internal';
import { ParamsTokenFactory } from '../../../../packages/core/pipes/params-token-factory.js';

describe('ParamsTokenFactory.exchangeEnumForString', () => {
  it.each([
    RouteParamtypes.BODY,
    RouteParamtypes.PARAM,
    RouteParamtypes.QUERY,
    RouteParamtypes.REQUEST,
  ])('switch case %i', type => {
    new ParamsTokenFactory().exchangeEnumForString(type);
  });
});
