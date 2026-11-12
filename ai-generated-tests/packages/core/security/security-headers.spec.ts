/**
 * CFT checklist extracted from packages/core/security/security-headers.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * SecurityHeadersConfigurationError.constructor @L119 - D=0, P=1.
 * fail @L125 - D=0, P=1.
 * serializeContentSecurityPolicy @L136 - D=11, P=12.
 *   1=typeof useDefaults !== 'boolean'
 *   2c1=!isObject(directives) | 2c2=Array.isArray(directives)
 *   3=useDefaults
 *   4=next iteration of Object.entries( DEFAULT_CONTENT_SECURITY_POLICY_DIRECTIVES, )
 *   5=next iteration of Object.entries(directives)
 *   6=seen.has(name)
 *   7=values === null
 *   8c1=!result.has('default-src') | 8c2=!removed.has('default-src')
 *   9=result.size === 0
 * callback @L184 - D=1, P=2.
 *   1=values.length > 0
 * normalizeDirectiveName @L189 - D=2, P=3.
 *   1=DIRECTIVE_NAME.test(rawName)
 *   2=!NORMALIZED_DIRECTIVE_NAME.test(name)
 * callback @L191 - D=0, P=1.
 * normalizeDirectiveValue @L203 - D=6, P=7.
 *   1c1=value === null | 1c2=value === false | 1c3=value === undefined
 *   2=value === true
 *   3=isString(value)
 *   4=!Array.isArray(values)
 * callback @L220 - D=4, P=5.
 *   1c1=!isString(item) | 1c2=item.trim().length === 0
 *   2=FORBIDDEN_VALUE_CHARACTERS.test(item)
 *   3=item.split(/\s+/).some(token => MUST_BE_QUOTED.test(token))
 * callback @L234 - D=0, P=1.
 * resolveSecurityHeaders @L252 - D=21, P=22.
 *   1=!isPlainObject(options)
 *   2=next iteration of Object.keys(options)
 *   3=!Object.hasOwn(OPTION_KEYS, name)
 *   4=current
 *   5=csp
 *   6=readBoolean(csp, 'contentSecurityPolicy', 'reportOnly', false)
 *   7=coep
 *   8=coop
 *   9=corp
 *   10=readOption(options, 'originAgentCluster', true)
 *   11=referrer
 *   12=hsts
 *   13=readOption(options, 'xContentTypeOptions', true)
 *   14=dnsPrefetch
 *   15=allow
 *   16=readOption(options, 'xDownloadOptions', true)
 *   17=frameOptions
 *   18=isString(action)
 *   19=crossDomain
 *   20=readOption(options, 'xXssProtection', true)
 *   21=readOption(options, 'xPoweredBy', true)
 * add @L269 - D=0, P=1.
 * readOption @L398 - D=9, P=10.
 *   1=value === undefined
 *   2=enabledByDefault
 *   3=typeof value === 'boolean'
 *   4=value
 *   5c1=keys.length === 0 | 5c2=!isPlainObject(value)
 *   6=keys.length > 0
 *   7=next iteration of Object.keys(value)
 *   8=!keys.includes(key)
 * callback @L421 - D=0, P=1.
 * readBoolean @L428 - D=2, P=3.
 *   1=value === undefined
 *   2=typeof value !== 'boolean'
 * pick @L446 - D=3, P=4.
 *   1=value === undefined
 *   2c1=!isString(value) | 2c2=!allowed.includes(value)
 * callback @L457 - D=0, P=1.
 * resolveReferrerPolicy @L464 - D=6, P=7.
 *   1=policy === undefined
 *   2=isString(policy)
 *   3c1=!Array.isArray(tokens) | 3c2=tokens.length === 0
 *   4=next iteration of tokens
 *   5=unique.has(token)
 * resolveHsts @L485 - D=5, P=6.
 *   1c1=typeof maxAge !== 'number' | 1c2=!Number.isFinite(maxAge) | 1c3=maxAge < 0
 *   2=readBoolean(option, 'strictTransportSecurity', 'includeSubDomains', true)
 *   3=readBoolean(option, 'strictTransportSecurity', 'preload')
 */
import { describe, it } from 'vitest';
import {
  serializeContentSecurityPolicy,
  resolveSecurityHeaders,
  SecurityHeadersConfigurationError,
} from '../../../../packages/core/security/security-headers.js';
function failure(callback: () => unknown) {
  try {
    callback();
  } catch (error) {
    if (!(error instanceof SecurityHeadersConfigurationError)) throw error;
  }
}
describe('security headers', () => {
  describe('serializeContentSecurityPolicy/normalizeDirectiveName/normalizeDirectiveValue', () => {
    it.each([
      undefined,
      {
        useDefaults: false,
        directives: {
          defaultSrc: null,
          scriptSrc: ["'self'"],
          upgradeInsecureRequests: true,
        },
      },
      {
        directives: {
          scriptSrc: ' https: ',
          styleSrc: false,
          imgSrc: undefined,
        },
      },
    ])('policy %j', options => {
      serializeContentSecurityPolicy(options as any);
    });
    it.each([
      { useDefaults: 'bad' },
      { directives: null },
      { directives: [] },
      { directives: { 'bad name': true } },
      { directives: { ScriptSrc: true } },
      { directives: { scriptSrc: [], 'script-src': [] } },
      { useDefaults: false, directives: { scriptSrc: [] } },
      { useDefaults: false, directives: { defaultSrc: null } },
      { directives: { scriptSrc: 1 } },
      ...[1, '', '  ', 'https:;bad', 'https:,bad', '\n', '\u00ff', 'self'].map(
        value => ({ directives: { scriptSrc: [value] } }),
      ),
    ])('invalid policy %j', options => {
      failure(() => serializeContentSecurityPolicy(options as any));
    });
  });
  describe('resolveSecurityHeaders/readOption/readBoolean/pick/resolveReferrerPolicy/resolveHsts', () => {
    it('default and all disabled', () => {
      const keys = [
        'contentSecurityPolicy',
        'crossOriginEmbedderPolicy',
        'crossOriginOpenerPolicy',
        'crossOriginResourcePolicy',
        'originAgentCluster',
        'referrerPolicy',
        'strictTransportSecurity',
        'xContentTypeOptions',
        'xDnsPrefetchControl',
        'xDownloadOptions',
        'xFrameOptions',
        'xPermittedCrossDomainPolicies',
        'xPoweredBy',
        'xXssProtection',
      ];
      resolveSecurityHeaders();
      resolveSecurityHeaders(Object.fromEntries(keys.map(key => [key, false])));
    });
    it.each([
      {
        contentSecurityPolicy: { reportOnly: true },
        crossOriginEmbedderPolicy: true,
      },
      {
        crossOriginEmbedderPolicy: { policy: 'credentialless' },
        crossOriginOpenerPolicy: { policy: 'unsafe-none' },
        crossOriginResourcePolicy: { policy: 'cross-origin' },
      },
      {
        referrerPolicy: { policy: 'same-origin' },
        strictTransportSecurity: {
          maxAge: 1.5,
          includeSubDomains: false,
          preload: true,
        },
        xDnsPrefetchControl: { allow: true },
      },
      {
        referrerPolicy: { policy: ['origin', 'same-origin'] },
        xFrameOptions: { action: 'DENY' },
        xPermittedCrossDomainPolicies: { permittedPolicies: 'all' },
      },
    ])('options %j', options => {
      resolveSecurityHeaders(options as any);
    });
    it.each([
      null,
      [],
      { unknown: true },
      { hsts: true },
      { originAgentCluster: {} },
      { crossOriginEmbedderPolicy: 1 },
      { crossOriginEmbedderPolicy: { unknown: true } },
      { contentSecurityPolicy: { reportOnly: 'bad' } },
      { crossOriginEmbedderPolicy: { policy: 1 } },
      { crossOriginEmbedderPolicy: { policy: 'bad' } },
      { xFrameOptions: { action: 1 } },
      { referrerPolicy: { policy: 1 } },
      { referrerPolicy: { policy: [] } },
      { referrerPolicy: { policy: ['origin', 'origin'] } },
      { referrerPolicy: { policy: ['bad'] } },
      ...['bad', Infinity, -1].map(maxAge => ({
        strictTransportSecurity: { maxAge },
      })),
      { strictTransportSecurity: { includeSubDomains: 'bad' } },
      { xDnsPrefetchControl: { allow: 1 } },
    ])('invalid options %j', options => {
      failure(() => resolveSecurityHeaders(options as any));
    });
  });
});
