/**
 * CFT checklist extracted from packages/core/security/cross-origin-protection.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * evaluateCrossOriginRequest @L91 - D=7, P=8.
 *   1=SAFE_METHODS.has(request.method)
 *   2=secFetchSite
 *   3c1=secFetchSite === 'same-origin' | 3c2=secFetchSite === 'none'
 *   4=!origin
 *   5c1=request.host !== undefined | 5c2=originMatchesHost(origin, request.host)
 * exemptOr @L117 - D=3, P=4.
 *   1=exemptions.isExcluded?.()
 *   2c1=request.origin !== undefined | 2c2=exemptions.trustedOrigins?.has(request.origin)
 * originMatchesHost @L134 - D=5, P=6.
 *   1=!url.host
 *   2=url.host === authority
 *   3c1=!url.port | 3c2=defaultPort !== undefined | 3c3=`${url.hostname}:${defaultPort}` === authority
 * normalizeTrustedOrigin @L166 - D=7, P=8.
 *   1c1=!isString(origin) | 1c2=origin.length === 0
 *   2=!/^[a-z][a-z0-9+.-]*:\/\/[^/?#\\]+$/i.test(origin)
 *   3=!url.host
 *   4c1=url.username | 4c2=url.password
 *   5=url.host.includes('*')
 * fail @L167 - D=0, P=1.
 * CrossOriginProtection.constructor @L233 - D=9, P=10.
 *   1=!isPlainObject(options)
 *   2=next iteration of Object.keys(options)
 *   3c1=key !== 'trustedOrigins' | 3c2=key !== 'exclude'
 *   4=!Array.isArray(trustedOrigins)
 *   5=isFunction(exclude)
 *   6=Array.isArray(exclude)
 *   7=next iteration of this.excludedRoutes
 *   8=exclude !== undefined
 * CrossOriginProtection.resolveExclusions @L284 - D=0, P=1.
 * CrossOriginProtection.callback @L285 - D=0, P=1.
 * CrossOriginProtection.callback @L288 - D=1, P=2.
 *   1=route.version
 * CrossOriginProtection.check @L305 - D=1, P=2.
 *   1=decision.allowed
 * CrossOriginProtection.callback @L318 - D=0, P=1.
 * CrossOriginProtection.isExcluded @L327 - D=10, P=11.
 *   1=this.excludePredicate
 *   2=this.resolvedExclusions.length === 0
 *   3=queryIndex >= 0
 *   4c1=!pathname.startsWith('/') | 4c2=NON_CANONICAL_PATH.test(pathname)
 *   5c1=this.ignoreTrailingSlash | 5c2=pathname.length > 1 | 5c3=pathname.endsWith('/')
 *   6c1=isPathExcluded(pathname) | 6c2=isPathExcluded(pathname.replace(/\/+$/, ''))
 * CrossOriginProtection.isPathExcluded @L345 - D=0, P=1.
 * CrossOriginProtection.callback @L347 - D=2, P=3.
 *   1c1=isRouteExcluded( [exclusion], path, RequestMethod[method as keyof typeof RequestMethod], ) | 1c2=isVersionRequested(exclusion)
 * toRouteInfo @L370 - D=5, P=6.
 *   1=isString(route)
 *   2c1=!route | 2c2=!isString(route.path) | 2c3=typeof route.method !== 'number' | 2c4=RequestMethod[route.method] === undefined
 * compileExclusion @L395 - D=3, P=4.
 *   1=converted.length > 1
 *   2c1=addLeadingSlash(normalized) | 2c2='/'
 * readHeader @L413 - D=2, P=3.
 *   1=value === undefined
 *   2=Array.isArray(value)
 */
import { describe, it } from 'vitest';
import { RequestMethod, VersioningType } from '@nestjs/common';
import {
  evaluateCrossOriginRequest,
  normalizeTrustedOrigin,
  CrossOriginProtection,
} from '../../../../packages/core/security/cross-origin-protection.js';
import { ApplicationConfig } from '../../../../packages/core/application-config.js';
import { RouteInfoPathExtractor } from '../../../../packages/core/middleware/route-info-path-extractor.js';
function failure(callback: () => unknown) {
  try {
    callback();
  } catch (error) {
    if (!(error instanceof Error)) throw error;
  }
}
const adapter: any = {
  getRequestMethod: (req: any) => req.method,
  getRequestUrl: (req: any) => req.url,
  getRouteMatchingOptions: () => ({ ignoreTrailingSlash: true }),
};
describe('cross-origin protection', () => {
  describe('evaluateCrossOriginRequest/exemptOr/originMatchesHost', () => {
    it.each([
      { method: 'GET' },
      { method: 'POST' },
      { method: 'POST', secFetchSite: 'same-origin' },
      { method: 'POST', secFetchSite: 'none' },
      { method: 'POST', secFetchSite: 'cross-site' },
      { method: 'POST', origin: 'https://host', host: 'host' },
      { method: 'POST', origin: 'https://host', host: 'HOST:443' },
      { method: 'POST', origin: 'http://host', host: 'host:80' },
      { method: 'POST', origin: 'http://host:3000', host: 'host:3001' },
      { method: 'POST', origin: 'ftp://host', host: 'host:21' },
      { method: 'POST', origin: 'data:text/plain,value', host: 'host' },
      { method: 'POST', origin: 'null', host: 'host' },
      { method: 'POST', origin: 'https://host' },
    ])('request %j', request => {
      evaluateCrossOriginRequest(request);
    });
    it.each([true, false])(
      'excluded %s and trusted-origin decisions',
      excluded => {
        evaluateCrossOriginRequest(
          {
            method: 'POST',
            secFetchSite: 'cross-site',
            origin: 'https://trusted',
          },
          {
            isExcluded: () => excluded,
            trustedOrigins: new Set(['https://trusted']),
          },
        );
        evaluateCrossOriginRequest(
          { method: 'POST', secFetchSite: 'cross-site' },
          { isExcluded: () => excluded, trustedOrigins: new Set() },
        );
      },
    );
  });
  describe('normalizeTrustedOrigin', () => {
    it.each(['HTTPS://Host:443', 'http://host:8080', 'custom://host'])(
      'origin %s',
      origin => {
        normalizeTrustedOrigin(origin);
      },
    );
    it.each([
      undefined,
      '',
      'http://host/',
      'http://[invalid',
      'http://user@host',
      'http://:password@host',
      'http://*.host',
      // URL canonicalizes localhost in the file scheme to an empty host.
      'file://localhost',
    ])('invalid %s', origin => {
      failure(() => normalizeTrustedOrigin(origin as any));
    });
  });
  describe('constructor/toRouteInfo/compileExclusion', () => {
    it.each([
      null,
      [],
      { unknown: true },
      { trustedOrigins: 'bad' },
      { exclude: 1 },
      { exclude: [null] },
      { exclude: [{}] },
      { exclude: [{ path: 1, method: 0 }] },
      { exclude: [{ path: '/', method: 'GET' }] },
      { exclude: [{ path: '/', method: 999 }] },
      { exclude: ['bad['] },
    ])('invalid %j', options => {
      failure(() => new CrossOriginProtection(adapter, options as any));
    });
  });
  describe('resolveExclusions/check/isExcluded/readHeader', () => {
    // isExcluded trailing-slash path 1c1(T), with 1c2(F/T) after trimming.
    it('requires both original and trimmed paths to match wildcard exclusions', () => {
      const protection = new CrossOriginProtection(adapter, {
        exclude: ['/allowed/{*path}'],
      });
      protection.resolveExclusions(
        new RouteInfoPathExtractor(new ApplicationConfig()),
      );
      for (const url of ['/allowed/', '/allowed/child/']) {
        protection.check({
          method: 'POST',
          url,
          headers: { origin: 'https://evil' },
        });
      }
    });
    it('route exclusions, query paths, noncanonical paths and missing URL', () => {
      const config = new ApplicationConfig();
      const protection = new CrossOriginProtection(adapter, {
        trustedOrigins: ['https://trusted'],
        exclude: [
          '/excluded',
          '/',
          { path: '/version', method: RequestMethod.POST, version: '1' },
        ],
      });
      protection.check({
        method: 'POST',
        headers: { 'sec-fetch-site': 'cross-site' },
        url: '/excluded',
      });
      protection.resolveExclusions(new RouteInfoPathExtractor(config));
      for (const url of [
        '/excluded',
        '/excluded?x=1',
        '/excluded/',
        '/other/',
        '/',
        'http://host/excluded',
        '/a//b',
        '/a#b',
        undefined,
      ])
        protection.check({
          method: 'POST',
          url,
          headers: { 'sec-fetch-site': 'cross-site' },
        });
      protection.check({
        method: 'POST',
        url: '/excluded',
        headers: { 'sec-fetch-site': ['cross-site', 'same-origin'] },
      });
      protection.check({
        method: 'POST',
        url: '/other',
        headers: {
          origin: 'https://host',
          ':authority': 'host',
          host: 'different',
        },
      });
      protection.check({ method: 'GET' });
      const versioned = new ApplicationConfig();
      versioned.enableVersioning({
        type: VersioningType.HEADER,
        header: 'version',
      });
      protection.resolveExclusions(new RouteInfoPathExtractor(versioned));
      protection.check({
        method: 'POST',
        url: '/version',
        headers: { origin: 'https://evil', version: '1' },
      });
    });
    it.each([true, false])('predicate exclusion %s', excluded => {
      new CrossOriginProtection(adapter, { exclude: () => excluded }).check({
        method: 'POST',
        headers: { origin: 'https://evil' },
      });
    });
  });
});
