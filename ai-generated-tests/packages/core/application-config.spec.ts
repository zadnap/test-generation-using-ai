/**
 * CFT checklist extracted from packages/core/application-config.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * ApplicationConfig.constructor @L36 - D=0, P=1.
 * ApplicationConfig.setGlobalPrefix @L38 - D=0, P=1.
 * ApplicationConfig.getGlobalPrefix @L42 - D=0, P=1.
 * ApplicationConfig.setGlobalPrefixOptions @L46 - D=0, P=1.
 * ApplicationConfig.getGlobalPrefixOptions @L52 - D=0, P=1.
 * ApplicationConfig.setIoAdapter @L56 - D=0, P=1.
 * ApplicationConfig.getIoAdapter @L60 - D=0, P=1.
 * ApplicationConfig.addGlobalPipe @L64 - D=0, P=1.
 * ApplicationConfig.useGlobalPipes @L68 - D=0, P=1.
 * ApplicationConfig.getGlobalFilters @L72 - D=0, P=1.
 * ApplicationConfig.addGlobalFilter @L76 - D=0, P=1.
 * ApplicationConfig.useGlobalFilters @L80 - D=0, P=1.
 * ApplicationConfig.getGlobalPipes @L84 - D=0, P=1.
 * ApplicationConfig.getGlobalInterceptors @L88 - D=0, P=1.
 * ApplicationConfig.addGlobalInterceptor @L92 - D=0, P=1.
 * ApplicationConfig.useGlobalInterceptors @L96 - D=0, P=1.
 * ApplicationConfig.getGlobalGuards @L100 - D=0, P=1.
 * ApplicationConfig.addGlobalGuard @L104 - D=0, P=1.
 * ApplicationConfig.useGlobalGuards @L108 - D=0, P=1.
 * ApplicationConfig.addGlobalRequestInterceptor @L112 - D=0, P=1.
 * ApplicationConfig.getGlobalRequestInterceptors @L118 - D=0, P=1.
 * ApplicationConfig.addGlobalRequestPipe @L122 - D=0, P=1.
 * ApplicationConfig.getGlobalRequestPipes @L126 - D=0, P=1.
 * ApplicationConfig.addGlobalRequestFilter @L130 - D=0, P=1.
 * ApplicationConfig.getGlobalRequestFilters @L134 - D=0, P=1.
 * ApplicationConfig.addGlobalRequestGuard @L138 - D=0, P=1.
 * ApplicationConfig.getGlobalRequestGuards @L142 - D=0, P=1.
 * ApplicationConfig.registerPreRequestHook @L146 - D=0, P=1.
 * ApplicationConfig.getGlobalPreRequestHooks @L150 - D=0, P=1.
 * ApplicationConfig.enableVersioning @L154 - D=1, P=2.
 *   1=Array.isArray(options.defaultVersion)
 * ApplicationConfig.getVersioning @L163 - D=0, P=1.
 * ApplicationConfig.setRouteConflictPolicy @L167 - D=0, P=1.
 * ApplicationConfig.getRouteConflictPolicy @L171 - D=0, P=1.
 * ApplicationConfig.setRouteResolutionStrategy @L175 - D=0, P=1.
 * ApplicationConfig.getRouteResolutionStrategy @L181 - D=0, P=1.
 * ApplicationConfig.setCookieSigner @L185 - D=0, P=1.
 * ApplicationConfig.getCookieSigner @L189 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { VersioningType } from '@nestjs/common';
import { ApplicationConfig } from '../../../packages/core/application-config.js';

describe('ApplicationConfig', () => {
  describe('prefix and adapter accessors', () => {
    it('reads defaults and assigned values', () => {
      const config = new ApplicationConfig();
      config.getGlobalPrefix();
      config.getGlobalPrefixOptions();
      config.getIoAdapter();
      config.setGlobalPrefix('/api');
      config.setGlobalPrefixOptions({ exclude: [] });
      config.setIoAdapter({} as any);
      config.getGlobalPrefix();
      config.getGlobalPrefixOptions();
      config.getIoAdapter();
    });
  });
  describe.each([
    ['Pipe', 'Pipes'],
    ['Filter', 'Filters'],
    ['Interceptor', 'Interceptors'],
    ['Guard', 'Guards'],
  ])('global %s registration', (singular, plural) => {
    it('add/use/get and request-scoped add/get', () => {
      const config: any = new ApplicationConfig();
      config[`getGlobal${plural}`]();
      config[`addGlobal${singular}`]({});
      config[`useGlobal${plural}`]({}, {});
      config[`getGlobal${plural}`]();
      config[`addGlobalRequest${singular}`]({});
      config[`getGlobalRequest${plural}`]();
    });
  });
  describe('pre-request hooks', () => {
    it('registers and reads', () => {
      const config = new ApplicationConfig();
      config.getGlobalPreRequestHooks();
      config.registerPreRequestHook(() => undefined);
      config.getGlobalPreRequestHooks();
    });
  });
  describe('enableVersioning/getVersioning', () => {
    it.each(
      [undefined, '1', ['1', '1', '2']].map(defaultVersion => ({
        defaultVersion,
      })),
    )('defaultVersion $defaultVersion, 1(T/F)', ({ defaultVersion }) => {
      const config = new ApplicationConfig();
      config.getVersioning();
      config.enableVersioning({ type: VersioningType.URI, defaultVersion });
      config.getVersioning();
    });
  });
  describe.each([
    ['RouteConflictPolicy', 'error'],
    ['RouteResolutionStrategy', 'specificity'],
    ['CookieSigner', {}],
  ])('%s setters/getters', (suffix, value) => {
    it('reads defaults and assignments', () => {
      const config: any = new ApplicationConfig();
      config[`get${suffix}`]();
      config[`set${suffix}`](value);
      config[`get${suffix}`]();
      config[`set${suffix}`](undefined);
    });
  });
});
