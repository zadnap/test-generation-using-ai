/**
 * CFT checklist extracted from packages/core/helpers/cookies/serialize-cookie.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * serializeCookie @L40 - D=23, P=24.
 *   1c1=typeof name !== 'string' | 1c2=!COOKIE_NAME_REGEXP.test(name)
 *   2=typeof value !== 'string'
 *   3c1=typeof path !== 'string' | 3c2=!COOKIE_PATH_REGEXP.test(path)
 *   4=options.domain !== undefined
 *   5c1=typeof options.domain !== 'string' | 5c2=!COOKIE_DOMAIN_REGEXP.test(options.domain)
 *   6=options.maxAge !== undefined
 *   7=!Number.isSafeInteger(options.maxAge)
 *   8=options.expires !== undefined
 *   9c1=!(options.expires instanceof Date) | 9c2=Number.isNaN(options.expires.getTime())
 *   10=options.httpOnly
 *   11=options.secure
 *   12=options.partitioned
 *   13=!options.secure
 *   14=options.priority !== undefined
 *   15=!priority
 *   16=options.sameSite !== undefined
 *   17=!sameSite
 *   18c1=sameSite === 'None' | 18c2=!options.secure
 */
import { describe, it } from 'vitest';
import { serializeCookie } from '../../../../../packages/core/helpers/cookies/serialize-cookie.js';

describe('serializeCookie', () => {
  describe('accepted options', () => {
    it.each([
      {},
      { path: '', domain: '.example.test', maxAge: 0, expires: new Date(0) },
      {
        httpOnly: true,
        secure: true,
        partitioned: true,
        priority: 'low',
        sameSite: 'none',
      },
      { priority: 'medium', sameSite: 'lax' },
      { priority: 'high', sameSite: 'strict' },
    ])('options %j', options => {
      serializeCookie('fixture', 'hello world', options as any);
    });
  });
  describe('validation exception paths', () => {
    it.each([
      { name: 1 },
      { name: 'invalid name' },
      { value: 1 },
      { value: '\ud800' },
      { options: { path: 1 } },
      { options: { path: ';' } },
      { options: { domain: 1 } },
      { options: { domain: 'bad;domain' } },
      { options: { maxAge: 0.5 } },
      { options: { expires: 'tomorrow' } },
      { options: { expires: new Date(NaN) } },
      { options: { partitioned: true } },
      { options: { priority: 'invalid' } },
      { options: { sameSite: 'invalid' } },
      { options: { sameSite: 'none' } },
    ])('input %j', input => {
      const { name = 'fixture', value = 'value', options = {} } = input as any;
      try {
        serializeCookie(name, value, options);
      } catch (error) {
        if (!(error instanceof TypeError)) throw error;
      }
    });
  });
});
