/**
 * CFT checklist extracted from packages/core/router/legacy-route-converter.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * UNSUPPORTED_PATH_MESSAGE @L3 - D=0, P=1.
 * LegacyRouteConverter.tryConvert @L17 - D=9, P=10.
 *   1=route.startsWith('/')
 *   2=route.endsWith('/')
 *   3=loggingEnabled
 *   4=normalizedRoute.endsWith('/(.*)/')
 *   5=normalizedRoute !== '/(.*)/'
 *   6=normalizedRoute.endsWith('/* /')
 *   7=normalizedRoute !== '/* /'
 *   8=normalizedRoute.endsWith('/+/')
 *   9=normalizedRoute.includes('/* /')
 * LegacyRouteConverter.callback @L32 - D=0, P=1.
 * LegacyRouteConverter.callback @L67 - D=0, P=1.
 * LegacyRouteConverter.printError @L76 - D=0, P=1.
 * LegacyRouteConverter.printWarning @L80 - D=1, P=2.
 *   1=convertedRoute
 */
import { afterEach, describe, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { LegacyRouteConverter } from '../../../../packages/core/router/legacy-route-converter.js';
afterEach(() => vi.restoreAllMocks());
describe('LegacyRouteConverter', () => {
  it.each([
    'plain',
    '/plain/',
    '(.*)',
    '/users/(.*)',
    '*',
    '/users/*',
    '/+',
    '/users/*/child/*/end',
  ])('tryConvert %s', path => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    LegacyRouteConverter.tryConvert(path);
    LegacyRouteConverter.tryConvert(path, { logs: false });
    LegacyRouteConverter.printError(path);
    LegacyRouteConverter.printWarning(path);
  });
});
