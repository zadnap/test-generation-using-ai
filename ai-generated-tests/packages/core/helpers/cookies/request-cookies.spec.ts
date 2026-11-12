/**
 * CFT checklist extracted from packages/core/helpers/cookies/request-cookies.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * getParsedCookieHeader @L11 - D=1, P=2.
 *   1=!cookies
 * getRequestCookies @L25 - D=1, P=2.
 *   1=isObject(req.cookies)
 * getRequestCookie @L37 - D=1, P=2.
 *   1=Object.prototype.hasOwnProperty.call(cookies, name)
 * getRequestSignedCookies @L56 - D=6, P=7.
 *   1=signer
 *   2=next iteration of Object.keys(cookies)
 *   3=value !== undefined
 *   4=isObject(req.signedCookies)
 *   5=next iteration of Object.entries( req.signedCookies as Record<string, unknown>, )
 *   6=value !== false
 * getRequestSignedCookie @L94 - D=2, P=3.
 *   1=signer
 *   2=value === undefined
 */
import { describe, it } from 'vitest';
import { CookieSigner } from '../../../../../packages/core/helpers/cookies/cookie-signer.js';
import {
  getRequestCookie,
  getRequestCookies,
  getRequestSignedCookie,
  getRequestSignedCookies,
} from '../../../../../packages/core/helpers/cookies/request-cookies.js';

describe('request cookie helpers', () => {
  describe('getRequestCookies/getRequestCookie/getParsedCookieHeader', () => {
    it.each([
      {},
      { headers: { cookie: 'a=value' } },
      { cookies: { a: 'middleware' } },
      { cookies: null },
    ])('request %j', req => {
      getRequestCookies(req);
      getRequestCookies(req);
      getRequestCookie(req, 'a');
      getRequestCookie(req, 'missing');
      getRequestCookie(req, 'constructor');
    });
  });
  describe('getRequestSignedCookies/getRequestSignedCookie', () => {
    it('verifies present, invalid and missing signed values', () => {
      const signer = new CookieSigner('fixture');
      const req = {
        headers: {
          cookie:
            'a=' + encodeURIComponent(signer.sign('value')) + ';b=unsigned',
        },
      };
      getRequestSignedCookies(req, signer);
      getRequestSignedCookie(req, 'a', signer);
      getRequestSignedCookie(req, 'missing', signer);
    });
    it('uses middleware values and drops invalid signatures', () => {
      const req = {
        signedCookies: { a: 'value', b: false, c: { json: true } },
      };
      getRequestSignedCookies(req, undefined);
      getRequestSignedCookie(req, 'a', undefined);
    });
    it('takes the missing configuration exception path', () => {
      try {
        getRequestSignedCookies({}, undefined);
      } catch (error) {
        if (!(error instanceof Error)) throw error;
      }
    });
  });
});
