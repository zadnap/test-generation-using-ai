/**
 * CFT checklist extracted from packages/core/security/http-security-hook.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * HttpSecurityHook.setHeaders @L21 - D=0, P=1.
 * HttpSecurityHook.setCrossOriginProtection @L25 - D=0, P=1.
 * HttpSecurityHook.init @L34 - D=0, P=1.
 * HttpSecurityHook.handle @L44 - D=3, P=4.
 *   1=this.headers
 *   2=next iteration of this.headers.headers
 *   3=next iteration of this.headers.removeHeaders
 */
import { describe, it, vi } from 'vitest';
import { HttpSecurityHook } from '../../../../packages/core/security/http-security-hook.js';
import { ApplicationConfig } from '../../../../packages/core/application-config.js';
describe('HttpSecurityHook', () => {
  describe('setHeaders/setCrossOriginProtection/init/handle', () => {
    it('features absent/present and composed order', () => {
      const hook = new HttpSecurityHook();
      const response: any = { setHeader: vi.fn(), removeHeader: vi.fn() };
      hook.init(new ApplicationConfig());
      hook.handle({}, response);
      hook.setHeaders({
        headers: [['x-fixture', 'value']],
        removeHeaders: ['x-powered-by'],
      });
      hook.setCrossOriginProtection({
        resolveExclusions: vi.fn(),
        check: () => new Error('fixture'),
      } as any);
      hook.init(new ApplicationConfig());
      hook.handle({}, response);
    });
  });
});
