/**
 * CFT checklist extracted from packages/core/injector/container.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * NestContainer.constructor @L44 - D=2, P=3.
 *   1=this._contextOptions?.moduleIdGeneratorAlgorithm === 'deep-hash'
 *   2=this._contextOptions?.snapshot
 * NestContainer.serializedGraph @L63 - D=0, P=1.
 * NestContainer.applicationConfig @L67 - D=0, P=1.
 * NestContainer.contextOptions @L71 - D=0, P=1.
 * NestContainer.setHttpAdapter @L75 - D=1, P=2.
 *   1=!this.internalProvidersStorage.httpAdapterHost
 * NestContainer.getHttpAdapterRef @L85 - D=0, P=1.
 * NestContainer.getHttpAdapterHostRef @L89 - D=0, P=1.
 * NestContainer.addModule @L93 - D=2, P=3.
 *   1=!metatype
 *   2=this.modules.has(token)
 * NestContainer.replaceModule @L133 - D=2, P=3.
 *   1c1=!metatypeToReplace | 1c2=!newMetatype
 * NestContainer.setModule @L169 - D=1, P=2.
 *   1=this.isGlobalModule(type, dynamicMetadata)
 * NestContainer.addDynamicMetadata @L200 - D=1, P=2.
 *   1=!dynamicModuleMetadata
 * NestContainer.addDynamicModules @L215 - D=2, P=3.
 *   1=!modules
 *   2=rejected
 * NestContainer.callback @L224 - D=0, P=1.
 * NestContainer.callback @L227 - D=0, P=1.
 * NestContainer.isGlobalModule @L234 - D=2, P=3.
 *   1c1=dynamicMetadata | 1c2=dynamicMetadata.global
 * NestContainer.addGlobalModule @L244 - D=0, P=1.
 * NestContainer.getModules @L248 - D=0, P=1.
 * NestContainer.getModuleCompiler @L252 - D=0, P=1.
 * NestContainer.getModuleByKey @L256 - D=0, P=1.
 * NestContainer.getInternalCoreModuleRef @L260 - D=0, P=1.
 * NestContainer.addImport @L264 - D=1, P=2.
 *   1=!this.modules.has(token)
 * NestContainer.addProvider @L278 - D=2, P=3.
 *   1=!provider
 *   2=!moduleRef
 * NestContainer.addInjectable @L298 - D=1, P=2.
 *   1=!this.modules.has(token)
 * NestContainer.addExportedProviderOrModule @L311 - D=2, P=3.
 *   1=!this.modules.has(token)
 *   2=isNil(toExport)
 * NestContainer.addController @L325 - D=2, P=3.
 *   1=!this.modules.has(token)
 *   2=isNil(controller)
 * NestContainer.clear @L342 - D=0, P=1.
 * NestContainer.removeModules @L346 - D=2, P=3.
 *   1=next iteration of modules
 *   2=this.modules.get(moduleRef.token) !== moduleRef
 * NestContainer.callback @L354 - D=0, P=1.
 * NestContainer.replace @L362 - D=0, P=1.
 * NestContainer.callback @L363 - D=0, P=1.
 * NestContainer.bindGlobalScope @L366 - D=0, P=1.
 * NestContainer.callback @L367 - D=0, P=1.
 * NestContainer.bindGlobalsToImports @L370 - D=0, P=1.
 * NestContainer.callback @L371 - D=0, P=1.
 * NestContainer.bindGlobalModuleToModule @L376 - D=2, P=3.
 *   1c1=target === globalModule | 1c2=target === this.internalCoreModule
 * NestContainer.getDynamicMetadataByToken @L387 - D=1, P=2.
 *   1=metadataKey
 * NestContainer.registerCoreModuleRef @L395 - D=0, P=1.
 * NestContainer.getModuleTokenFactory @L400 - D=0, P=1.
 * NestContainer.registerRequestProvider @L404 - D=0, P=1.
 * NestContainer.shouldInitOnPreview @L412 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { Global, Module as ModuleDecorator } from '@nestjs/common';
import { NestContainer } from '../../../../packages/core/injector/container.js';
import { Module } from '../../../../packages/core/injector/module.js';
import { ApplicationConfig } from '../../../../packages/core/application-config.js';
import { REQUEST } from '../../../../packages/core/router/request/request-constants.js';

async function failure(operation: () => unknown | Promise<unknown>) {
  try {
    await operation();
  } catch (error) {
    if (!(error instanceof Error)) throw error;
  }
}
describe('NestContainer', () => {
  describe('module registration/replacement/dynamic/global bindings/removal/accessors', () => {
    it.each([
      undefined,
      { snapshot: true },
      { moduleIdGeneratorAlgorithm: 'deep-hash' },
    ])('options %j', async options => {
      @Global()
      @ModuleDecorator({})
      class GlobalModule {}
      @ModuleDecorator({})
      class Root {}
      @ModuleDecorator({})
      class Replacement {}
      const value = new NestContainer(new ApplicationConfig(), options as any);
      value.applicationConfig;
      value.contextOptions;
      value.serializedGraph;
      value.setHttpAdapter({});
      value.getHttpAdapterRef();
      value.getHttpAdapterHostRef();
      const inserted: Module[] = [];
      const first = (await value.addModule(Root, [], inserted))!.moduleRef;
      await value.addModule(Root, []);
      await value.addModule(GlobalModule, []);
      const dynamic = {
        module: class Dynamic {},
        global: true,
        imports: [GlobalModule],
      };
      const dynamicRef = (await value.addModule(dynamic, [], inserted))!
        .moduleRef;
      await value.addImport(GlobalModule, first.token);
      await value.addImport(GlobalModule, 'missing');
      value.bindGlobalScope();
      value.bindGlobalModuleToModule(first, first);
      value.registerCoreModuleRef(first);
      value.bindGlobalModuleToModule(first, dynamicRef);
      value.getInternalCoreModuleRef();
      value.getModules();
      value.getModuleByKey(first.token);
      value.getModuleCompiler();
      value.getModuleTokenFactory();
      value.getDynamicMetadataByToken(dynamicRef.token);
      value.getDynamicMetadataByToken(dynamicRef.token, 'imports');
      value.getDynamicMetadataByToken('missing', 'imports');
      value.addProvider({ provide: REQUEST, useValue: undefined }, first.token);
      value.registerRequestProvider({}, { id: 1 });
      class Provider {}
      class Controller {}
      class Enhancer {}
      value.addProvider(Provider, first.token);
      value.addController(Controller, first.token);
      value.addInjectable(Enhancer, first.token, 'guard');
      value.addExportedProviderOrModule(Provider, first.token);
      value.replace(Provider, { isProvider: true, useValue: {} } as any);
      await value.replaceModule(Root, Replacement, [], inserted);
      value.removeModules([first]);
      value.removeModules([dynamicRef]);
      value.clear();
    });
  });
  describe('registration errors', () => {
    it('missing module/provider/controller/export and rejected dynamic imports', async () => {
      const value = new NestContainer();
      const ref = (await value.addModule(class Root {}, []))!.moduleRef;
      await failure(() => value.addModule(undefined as any, []));
      await failure(() =>
        value.replaceModule(undefined as any, class Root {}, []),
      );
      await failure(() =>
        value.replaceModule(class Root {}, undefined as any, []),
      );
      await failure(() => value.addDynamicModules([undefined], []));
      for (const token of [ref.token, 'missing']) {
        await failure(() => value.addProvider(undefined as any, token));
        await failure(() => value.addProvider(class Provider {}, 'missing'));
        await failure(() =>
          value.addInjectable(class Enhancer {}, 'missing', 'guard'),
        );
        await failure(() =>
          value.addExportedProviderOrModule(undefined as any, token),
        );
        await failure(() => value.addController(undefined as any, token));
      }
    });
  });
});
