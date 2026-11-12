/**
 * CFT checklist extracted from packages/core/repl/repl-context.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * ReplContext.constructor @L39 - D=2, P=3.
 *   1c1=nativeFunctionsClassRefs | 1c2=[]
 * ReplContext.writeToStdout @L49 - D=0, P=1.
 * ReplContext.initializeContext @L53 - D=0, P=1.
 * ReplContext.callback @L56 - D=2, P=3.
 *   1=moduleName === InternalCoreModule.name
 *   2=this.globalScope[moduleName]
 * ReplContext.introspectCollection @L77 - D=0, P=1.
 * ReplContext.callback @L83 - D=4, P=5.
 *   1c1=stringifiedToken === ApplicationConfig.name | 1c2=stringifiedToken === moduleRef.metatype.name
 *   2=!this.globalScope[stringifiedToken]
 *   3=stringifiedToken === ModuleRef.name
 * ReplContext.stringifyToken @L114 - D=2, P=3.
 *   1=typeof token !== 'string'
 *   2=typeof token === 'function'
 * ReplContext.addNativeFunction @L122 - D=0, P=1.
 * ReplContext.callback @L130 - D=0, P=1.
 * ReplContext.registerFunctionIntoGlobalScope @L145 - D=0, P=1.
 * ReplContext.callback @L158 - D=0, P=1.
 * ReplContext.initializeNativeFunctions @L165 - D=0, P=1.
 * ReplContext.callback @L179 - D=0, P=1.
 * ReplContext.callback @L181 - D=0, P=1.
 */
import { describe, it, vi } from 'vitest';
import { ReplContext } from '../../../../packages/core/repl/repl-context.js';
import { ReplFunction } from '../../../../packages/core/repl/repl-function.js';
import { NestContainer } from '../../../../packages/core/injector/container.js';
import { InternalCoreModule } from '../../../../packages/core/injector/internal-core-module/internal-core-module.js';
import { Module } from '../../../../packages/core/injector/module.js';
describe('ReplContext', () => {
  describe('initializeContext/introspectCollection/stringifyToken/native functions/global help getters/writeToStdout', () => {
    it('same-named modules, class/string/symbol tokens, internal module and custom aliases', async () => {
      const container = new NestContainer();
      class Root {}
      class Provider {}
      class Controller {
        handle() {}
      }
      const first = (await container.addModule(Root, []))!.moduleRef;
      const second = new Module(Root, container);
      second.token = 'second';
      container.getModules().set('second', second);
      const internal = new Module(InternalCoreModule, container);
      container.getModules().set('internal', internal);
      first.addProvider(Provider);
      first.addProvider({ provide: 'string', useValue: 1 });
      first.addProvider({ provide: Symbol('fixture'), useValue: 2 });
      first.addController(Controller);
      second.addProvider(Provider);
      class Custom extends ReplFunction {
        fnDefinition = {
          name: 'custom',
          description: 'fixture',
          signature: '()',
          aliases: ['alias'],
        };
        action() {}
      }
      const app: any = {
        container,
        get: () => new Controller(),
        resolve: async () => ({}),
        select: () => ({}),
      };
      const ctx = new ReplContext(app, [Custom]);
      const write = vi
        .spyOn(ctx, 'writeToStdout')
        .mockImplementation(() => undefined);
      for (const native of ctx.nativeFunctions.values())
        native.makeHelpMessage();
      ctx.globalScope.custom();
      ctx.globalScope.alias.help;
      ctx.globalScope.get(Provider);
      ctx.globalScope.select(Root);
      await ctx.globalScope.resolve(Provider, {});
      write.mockRestore();
      ctx.writeToStdout('');
      new ReplContext({ container: new NestContainer() } as any);
    });
  });
});
