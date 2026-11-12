/**
 * CFT checklist extracted from packages/core/nest-application-context.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * NestApplicationContext.instanceLinksHost @L62 - D=1, P=2.
 *   1=!this._instanceLinksHost
 * NestApplicationContext.constructor @L69 - D=1, P=2.
 *   1=this.appOptions.preview
 * NestApplicationContext.selectContextModule @L84 - D=0, P=1.
 * NestApplicationContext.select @L93 - D=3, P=4.
 *   1=dynamicMetadata
 *   2=!selectedModule
 *   3=typeof selectOptions?.abortOnError !== 'undefined'
 * NestApplicationContext.get @L166 - D=1, P=2.
 *   1=!(options && options.strict)
 * NestApplicationContext.resolve @L227 - D=0, P=1.
 * NestApplicationContext.registerRequestByContextId @L244 - D=0, P=1.
 * NestApplicationContext.init @L254 - D=1, P=2.
 *   1=this.isInitialized
 * NestApplicationContext.callback @L258 - D=0, P=1.
 * NestApplicationContext.close @L279 - D=0, P=1.
 * NestApplicationContext.shutdown @L292 - D=0, P=1.
 * NestApplicationContext.callback @L293 - D=0, P=1.
 * NestApplicationContext.runShutdownSequence @L301 - D=0, P=1.
 * NestApplicationContext.callback @L306 - D=0, P=1.
 * NestApplicationContext.useLogger @L320 - D=1, P=2.
 *   1=this.shouldFlushLogsOnOverride
 * NestApplicationContext.flushLogs @L332 - D=0, P=1.
 * NestApplicationContext.flushLogsIfAutoFlushEnabled @L336 - D=1, P=2.
 *   1=this.appOptions?.autoFlushLogs ?? true
 * NestApplicationContext.flushLogsOnOverride @L345 - D=0, P=1.
 * NestApplicationContext.enableShutdownHooks @L362 - D=2, P=3.
 *   1c1=!signals | 1c2=isEmptyArray(signals)
 * NestApplicationContext.callback @L372 - D=0, P=1.
 * NestApplicationContext.callback @L374 - D=0, P=1.
 * NestApplicationContext.prepareClose @L380 - D=0, P=1.
 * NestApplicationContext.dispose @L386 - D=0, P=1.
 * NestApplicationContext.listenToShutdownSignals @L399 - D=0, P=1.
 * NestApplicationContext.cleanup @L403 - D=2, P=3.
 *   1=this.receivedSignal
 *   2=options.useProcessExit
 * NestApplicationContext.callback @L411 - D=0, P=1.
 * NestApplicationContext.callback @L432 - D=0, P=1.
 * NestApplicationContext.unsubscribeFromProcessSignals @L441 - D=0, P=1.
 * NestApplicationContext.callback @L442 - D=0, P=1.
 * NestApplicationContext.callInitHook @L452 - D=1, P=2.
 *   1=next iteration of modulesSortedByDistance
 * NestApplicationContext.callDestroyHook @L463 - D=1, P=2.
 *   1=next iteration of modulesSortedByDistance
 * NestApplicationContext.callBootstrapHook @L477 - D=1, P=2.
 *   1=next iteration of modulesSortedByDistance
 * NestApplicationContext.callShutdownHook @L488 - D=1, P=2.
 *   1=next iteration of modulesSortedByDistance
 * NestApplicationContext.callBeforeShutdownHook @L502 - D=1, P=2.
 *   1=next iteration of modulesSortedByDistance
 * NestApplicationContext.assertNotInPreviewMode @L512 - D=1, P=2.
 *   1=this.appOptions.preview
 * NestApplicationContext.getModulesToTriggerHooksOn @L520 - D=2, P=3.
 *   1=this._moduleRefsForHooksByDistance
 *   2=this.appOptions?.preview
 * NestApplicationContext.compareFn @L525 - D=0, P=1.
 * NestApplicationContext.callback @L531 - D=0, P=1.
 * NestApplicationContext.printInPreviewModeWarning @L536 - D=0, P=1.
 */
import { afterEach, describe, it, vi } from 'vitest';
import { Logger, Module, Injectable } from '@nestjs/common';
import { NestApplicationContext } from '../../../packages/core/nest-application-context.js';
import { NestContainer } from '../../../packages/core/injector/container.js';
afterEach(() => vi.restoreAllMocks());
describe('NestApplicationContext', () => {
  describe('constructor/init/shutdown/options/logger/signals', () => {
    it.each([false, true])('preview %s', async preview => {
      vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const container = new NestContainer();
      const ref = (await container.addModule(class Root {}, []))!.moduleRef;
      ref.addProvider({ provide: 'value', useValue: 1 });
      const context: any = new NestApplicationContext(container, {
        preview,
        abortOnError: false,
        autoFlushLogs: false,
      });
      context.selectContextModule();
      context.get('value');
      context.get('value', { each: true });
      context.select(ref.metatype);
      context.select(ref.metatype, { abortOnError: false });
      await context.init();
      await context.init();
      context.flushLogsIfAutoFlushEnabled();
      context.flushLogsOnOverride();
      context.useLogger(false);
      context.flushLogs();
      try {
        context.assertNotInPreviewMode('fixture');
      } catch (error) {
        if (!(error instanceof Error)) throw error;
      }
      context.enableShutdownHooks(['SIGTERM', ' sigterm ']);
      context.enableShutdownHooks(['SIGTERM']);
      await Promise.all([context.close(), context.close()]);
      context.enableShutdownHooks();
      await context.close();
    });
    it('init failure still allows shutdown', async () => {
      const container = new NestContainer();
      const ref = (await container.addModule(class Root {}, []))!.moduleRef;
      ref.getProviderByKey(ref.metatype).instance = {
        onModuleInit() {
          throw new Error('fixture');
        },
      };
      const context: any = new NestApplicationContext(container, {
        abortOnError: false,
      });
      try {
        await context.init();
      } catch (error) {
        if (!(error instanceof Error)) throw error;
      }
      await context.close();
    });
    it.each([false, true])(
      'signal termination stub useProcessExit %s',
      async useProcessExit => {
        vi.spyOn(process, 'kill').mockReturnValue(true);
        vi.spyOn(process, 'exit').mockImplementation((() => undefined) as any);
        const context: any = new NestApplicationContext(new NestContainer(), {
          abortOnError: false,
        });
        context.enableShutdownHooks(['SIGTERM'], { useProcessExit });
        const handler = context.shutdownCleanupRefs.get('SIGTERM');
        await Promise.all([handler('SIGTERM'), handler('SIGTERM')]);
        await context.close();
      },
    );
  });
});
