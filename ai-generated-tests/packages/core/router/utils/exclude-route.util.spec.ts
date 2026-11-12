/**
 * CFT checklist extracted from packages/core/router/utils/exclude-route.util.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * isRequestMethodAll @L5 - D=2, P=3.
 *   1c1=RequestMethod.ALL === method | 1c2=(method as number) === -1
 * isRouteExcluded @L9 - D=0, P=1.
 * callback @L14 - D=2, P=3.
 *   1c1=isRequestMethodAll(route.requestMethod) | 1c2=route.requestMethod === requestMethod
 */
import { describe, it } from 'vitest';
import { RequestMethod } from '@nestjs/common';
import {
  isRequestMethodAll,
  isRouteExcluded,
} from '../../../../../packages/core/router/utils/exclude-route.util.js';

describe('route exclusion', () => {
  describe('isRequestMethodAll', () => {
    it.each([RequestMethod.ALL, -1, RequestMethod.GET])(
      'method %i, 1c1/1c2',
      method => {
        isRequestMethodAll(method);
      },
    );
  });
  describe('isRouteExcluded', () => {
    it.each([
      [RequestMethod.ALL, '/match'],
      [RequestMethod.GET, '/match'],
      [RequestMethod.GET, '/miss'],
      [RequestMethod.POST, '/match'],
    ])('method %s path %s', (requestMethod, route) => {
      isRouteExcluded(
        [
          {
            path: '/match',
            pathRegex: /^\/match$/,
            requestMethod: requestMethod as number,
          },
        ],
        route as string,
        RequestMethod.GET,
      );
    });
    it('empty exclusions', () => {
      isRouteExcluded([], '/', RequestMethod.GET);
    });
  });
});
