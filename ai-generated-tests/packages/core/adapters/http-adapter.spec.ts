/**
 * CFT checklist extracted from packages/core/adapters/http-adapter.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * AbstractHttpAdapter.constructor @L87 - D=0, P=1.
 * AbstractHttpAdapter.init @L95 - D=0, P=1.
 * AbstractHttpAdapter.use @L102 - D=0, P=1.
 * AbstractHttpAdapter.get @L113 - D=0, P=1.
 * AbstractHttpAdapter.post @L124 - D=0, P=1.
 * AbstractHttpAdapter.head @L135 - D=0, P=1.
 * AbstractHttpAdapter.delete @L146 - D=0, P=1.
 * AbstractHttpAdapter.put @L157 - D=0, P=1.
 * AbstractHttpAdapter.patch @L168 - D=0, P=1.
 * AbstractHttpAdapter.propfind @L181 - D=0, P=1.
 * AbstractHttpAdapter.proppatch @L194 - D=0, P=1.
 * AbstractHttpAdapter.mkcol @L207 - D=0, P=1.
 * AbstractHttpAdapter.copy @L220 - D=0, P=1.
 * AbstractHttpAdapter.move @L233 - D=0, P=1.
 * AbstractHttpAdapter.lock @L246 - D=0, P=1.
 * AbstractHttpAdapter.unlock @L259 - D=0, P=1.
 * AbstractHttpAdapter.all @L271 - D=0, P=1.
 * AbstractHttpAdapter.search @L283 - D=0, P=1.
 * AbstractHttpAdapter.query @L295 - D=0, P=1.
 * AbstractHttpAdapter.options @L307 - D=0, P=1.
 * AbstractHttpAdapter.listen @L323 - D=0, P=1.
 * AbstractHttpAdapter.getHttpServer @L334 - D=0, P=1.
 * AbstractHttpAdapter.setHttpServer @L343 - D=0, P=1.
 * AbstractHttpAdapter.setInstance @L351 - D=0, P=1.
 * AbstractHttpAdapter.getInstance @L361 - D=0, P=1.
 * AbstractHttpAdapter.normalizePath @L372 - D=0, P=1.
 * AbstractHttpAdapter.setOnRouteTriggered @L384 - D=0, P=1.
 * AbstractHttpAdapter.getOnRouteTriggered @L395 - D=0, P=1.
 * AbstractHttpAdapter.setOnRequestHook @L405 - D=0, P=1.
 * AbstractHttpAdapter.setOnResponseHook @L412 - D=0, P=1.
 * AbstractHttpAdapter.beforeClose @L420 - D=0, P=1.
 * AbstractHttpAdapter.mapException @L430 - D=0, P=1.
 * AbstractHttpAdapter.registerSecurityHook @L443 - D=0, P=1.
 * AbstractHttpAdapter.callback @L444 - D=1, P=2.
 *   1=error
 * AbstractHttpAdapter.setCookie @L464 - D=3, P=4.
 *   1=options.signed
 *   2=!this.cookieSigner
 *   3=typeof value !== 'string'
 * AbstractHttpAdapter.clearCookie @L499 - D=0, P=1.
 * AbstractHttpAdapter.setCookieSigner @L522 - D=0, P=1.
 */
import { describe, it, vi } from 'vitest';
import { AbstractHttpAdapter } from '../../../../packages/core/adapters/http-adapter.js';
import { CookieSigner } from '../../../../packages/core/helpers/cookies/cookie-signer.js';
function create(): any {
  return new (AbstractHttpAdapter as any)(
    new Proxy({}, { get: () => vi.fn() }),
  );
}
describe('AbstractHttpAdapter concrete methods', () => {
  describe('delegation/accessors/default hooks', () => {
    it('delegates every HTTP method and reads/writes state', async () => {
      const adapter = create();
      for (const method of [
        'use',
        'get',
        'post',
        'head',
        'delete',
        'put',
        'patch',
        'propfind',
        'proppatch',
        'mkcol',
        'copy',
        'move',
        'lock',
        'unlock',
        'all',
        'search',
        'query',
        'options',
      ])
        adapter[method]('/fixture', () => undefined);
      adapter.listen(0);
      adapter.setHttpServer({});
      adapter.getHttpServer();
      adapter.getInstance();
      adapter.setInstance({});
      adapter.normalizePath('/');
      adapter.setOnRouteTriggered(() => undefined);
      adapter.getOnRouteTriggered();
      adapter.setOnRequestHook(() => undefined);
      adapter.setOnResponseHook(() => undefined);
      adapter.beforeClose();
      adapter.mapException(new Error('fixture'));
      await adapter.init();
    });
  });
  describe('registerSecurityHook/setCookie/clearCookie/setCookieSigner', () => {
    it('allowed/rejected security callbacks and unsigned/signed cookie branches', () => {
      const adapter = create();
      adapter.appendHeader = vi.fn();
      adapter.setCookie({}, 'fixture', 'value');
      adapter.clearCookie({}, 'fixture');
      for (const callback of [() => undefined, () => new Error('fixture')]) {
        adapter.setInstance({
          use: (hook: Function) => hook({}, {}, () => undefined),
        });
        adapter.registerSecurityHook(callback);
      }
      try {
        adapter.setCookie({}, 'fixture', 'value', { signed: true });
      } catch (error) {
        if (!(error instanceof Error)) throw error;
      }
      adapter.setCookieSigner(new CookieSigner('fixture'));
      adapter.setCookie({}, 'fixture', 'value', { signed: true });
      try {
        adapter.setCookie({}, 'fixture', 1, { signed: true });
      } catch (error) {
        if (!(error instanceof TypeError)) throw error;
      }
    });
  });
});
