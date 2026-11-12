/**
 * CFT checklist extracted from packages/core/router/route-params-factory.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * getBodyProperty @L20 - D=5, P=6.
 *   1c1=isObject(body) | 1c2=!Array.isArray(body) | 1c3=!ArrayBuffer.isView(body) | 1c4=!isNil(body) | 1c5=Object.hasOwn(Object(body), key)
 * RouteParamsFactory.constructor @L27 - D=0, P=1.
 * RouteParamsFactory.exchangeKeyForValue @L29 - D=27, P=28.
 *   1=case RouteParamtypes.NEXT
 *   2=case RouteParamtypes.REQUEST
 *   3=case RouteParamtypes.RESPONSE
 *   4=case RouteParamtypes.BODY
 *   5c1=data | 5c2=req.body
 *   6=case RouteParamtypes.RAW_BODY
 *   7=case RouteParamtypes.PARAM
 *   8=data
 *   9=case RouteParamtypes.HOST
 *   10c1=req.hosts | 10c2={}
 *   11=data
 *   12=case RouteParamtypes.QUERY
 *   13=data
 *   14=case RouteParamtypes.HEADERS
 *   15=data
 *   16=case RouteParamtypes.SESSION
 *   17=case RouteParamtypes.FILE
 *   18c1=data | 18c2='file'
 *   19=case RouteParamtypes.FILES
 *   20=case RouteParamtypes.IP
 *   21=case RouteParamtypes.COOKIES
 *   22=data
 *   23=case RouteParamtypes.SIGNED_COOKIES
 *   24=data
 */
import { describe, it } from 'vitest';
import { RouteParamtypes } from '@nestjs/common/internal';
import { RouteParamsFactory } from '../../../../packages/core/router/route-params-factory.js';
import { ApplicationConfig } from '../../../../packages/core/application-config.js';
import { CookieSigner } from '../../../../packages/core/helpers/cookies/cookie-signer.js';

describe('RouteParamsFactory', () => {
  describe('exchangeKeyForValue', () => {
    it.each(
      Object.values(RouteParamtypes).filter(value => typeof value === 'number'),
    )('parameter kind %s, keyed/unkeyed', key => {
      const req = {
        body: { field: 'value' },
        rawBody: Buffer.from('raw'),
        params: { field: 1 },
        hosts: { field: 'host' },
        query: { field: 2 },
        headers: { field: 'header' },
        session: {},
        file: {},
        files: [],
        ip: '127.0.0.1',
        signedCookies: { field: 'signed' },
        cookies: { field: 'cookie' },
      };
      const factory = new RouteParamsFactory();
      factory.exchangeKeyForValue(key as number, 'field', {
        req,
        res: {},
        next: () => undefined,
      });
      factory.exchangeKeyForValue(key as number, '', {
        req,
        res: {},
        next: () => undefined,
      });
    });
    it('unknown type and host fallback', () => {
      const factory = new RouteParamsFactory();
      factory.exchangeKeyForValue('unknown', '', {
        req: {},
        res: {},
        next: () => undefined,
      });
      factory.exchangeKeyForValue(RouteParamtypes.HOST, '', {
        req: {},
        res: {},
        next: () => undefined,
      });
    });
    it.each(
      [
        undefined,
        null,
        false,
        'text',
        ['first'],
        Buffer.from('value'),
        {},
        Object.create({ field: 'inherited' }),
      ].map(body => ({ body })),
    )('body $body/getBodyProperty', ({ body }) => {
      const factory = new RouteParamsFactory();
      for (const key of ['field', '0', 'length', 'values', 'parent'])
        factory.exchangeKeyForValue(RouteParamtypes.BODY, key, {
          req: { body },
          res: {},
          next: () => undefined,
        });
    });
    it('configured signed cookies', () => {
      const config = new ApplicationConfig();
      config.setCookieSigner(new CookieSigner('fixture'));
      const factory = new RouteParamsFactory(config);
      factory.exchangeKeyForValue(RouteParamtypes.SIGNED_COOKIES, 'a', {
        req: { headers: {} },
        res: {},
        next: () => undefined,
      });
    });
  });
});
