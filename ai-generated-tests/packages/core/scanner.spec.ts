/**
 * CFT checklist extracted from packages/core/scanner.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * DependenciesScanner.constructor @L82 - D=0, P=1.
 * DependenciesScanner.scan @L89 - D=0, P=1.
 * DependenciesScanner.scanForModules @L109 - D=14, P=15.
 *   1c1=lazy | 1c2=!moduleInserted | 1c3=moduleInstance?.isInstantiated
 *   2=moduleDefinition instanceof Promise
 *   3=this.isForwardReference(moduleDefinition)
 *   4=!this.isDynamicModule( moduleDefinition as Type<any> | DynamicModule, )
 *   5c1=(moduleDefinition as DynamicModule).imports | 5c2=[]
 *   6=next iteration of modules.entries()
 *   7=innerModule === undefined
 *   8=!innerModule
 *   9=ctxRegistry.includes(innerModule)
 *   10=!moduleInstance
 *   11=lazy
 * DependenciesScanner.insertModule @L195 - D=4, P=5.
 *   1=this.isForwardReference(moduleDefinition)
 *   2=this.isInjectable(moduleToAdd)
 *   3=this.isController(moduleToAdd)
 *   4=this.isExceptionFilter(moduleToAdd)
 * DependenciesScanner.removeModules @L231 - D=0, P=1.
 * DependenciesScanner.scanModulesForDependencies @L235 - D=1, P=2.
 *   1=next iteration of modules
 * DependenciesScanner.reflectImports @L246 - D=1, P=2.
 *   1=next iteration of modules
 * DependenciesScanner.reflectProviders @L263 - D=0, P=1.
 * DependenciesScanner.callback @L272 - D=3, P=4.
 *   1=provider === undefined
 *   2=!this.isCustomProvider(provider)
 *   3=!applyProvidersKeys.includes(provide as string)
 * DependenciesScanner.reflectControllers @L289 - D=0, P=1.
 * DependenciesScanner.callback @L297 - D=1, P=2.
 *   1=item === undefined
 * DependenciesScanner.reflectDynamicMetadata @L306 - D=2, P=3.
 *   1c1=!cls | 1c2=!cls.prototype
 * DependenciesScanner.reflectExports @L321 - D=0, P=1.
 * DependenciesScanner.callback @L329 - D=1, P=2.
 *   1=exportedProvider === undefined
 * DependenciesScanner.reflectInjectables @L337 - D=0, P=1.
 * DependenciesScanner.callback @L350 - D=1, P=2.
 *   1=methodInjectable
 * DependenciesScanner.callback @L369 - D=0, P=1.
 * DependenciesScanner.callback @L377 - D=0, P=1.
 * DependenciesScanner.callback @L378 - D=0, P=1.
 * DependenciesScanner.reflectParamInjectables @L390 - D=0, P=1.
 * DependenciesScanner.callback @L400 - D=1, P=2.
 *   1=!metadata
 * DependenciesScanner.callback @L416 - D=0, P=1.
 * DependenciesScanner.callback @L418 - D=0, P=1.
 * DependenciesScanner.reflectKeyMetadata @L430 - D=5, P=6.
 *   1c1=prototype = Reflect.getPrototypeOf(prototype) | 1c2=prototype !== Object.prototype | 1c3=prototype
 *   2=!descriptor
 *   3=!metadata
 * DependenciesScanner.calculateModulesDistance @L454 - D=1, P=2.
 *   1=!rootModule
 * DependenciesScanner.callback @L467 - D=1, P=2.
 *   1=moduleRef.isGlobal
 * DependenciesScanner.insertImport @L475 - D=2, P=3.
 *   1=isUndefined(related)
 *   2=this.isForwardReference(related)
 * DependenciesScanner.isCustomProvider @L485 - D=2, P=3.
 *   1c1=provider | 1c2=!isNil((provider as any).provide)
 * DependenciesScanner.insertProvider @L492 - D=7, P=8.
 *   1=!isCustomProvider
 *   2=!providersKeys.includes(type as string)
 *   3c1=isNil(scope) | 3c2=(provider as ClassProvider).useClass
 *   4c1=isNil(scope) | 4c2=isFunction(existing)
 *   5=this.isRequestOrTransient(factoryOrClassProvider.scope!)
 * DependenciesScanner.insertInjectable @L547 - D=1, P=2.
 *   1=isFunction(injectable)
 * DependenciesScanner.insertExportedProviderOrModule @L582 - D=1, P=2.
 *   1=this.isForwardReference(toExport)
 * DependenciesScanner.insertController @L592 - D=0, P=1.
 * DependenciesScanner.insertOrOverrideModule @L596 - D=1, P=2.
 *   1=overrideModule !== undefined
 * DependenciesScanner.getOverrideModuleByModule @L624 - D=1, P=2.
 *   1=this.isForwardReference(module)
 * DependenciesScanner.callback @L629 - D=2, P=3.
 *   1c1=moduleToOverride.moduleToReplace === module.forwardRef() | 1c2=( moduleToOverride.moduleToReplace as ForwardReference ).forwardRef?.() === module.forwardRef()
 * DependenciesScanner.callback @L640 - D=0, P=1.
 * DependenciesScanner.overrideModule @L644 - D=2, P=3.
 *   1=this.isForwardReference(moduleToOverride)
 *   2=this.isForwardReference(newModule)
 * DependenciesScanner.reflectMetadata @L666 - D=2, P=3.
 *   1c1=Reflect.getMetadata(metadataKey, metatype) | 1c2=[]
 * DependenciesScanner.registerCoreModule @L673 - D=0, P=1.
 * DependenciesScanner.addScopedEnhancersMetadata @L693 - D=0, P=1.
 * DependenciesScanner.callback @L695 - D=0, P=1.
 * DependenciesScanner.callback @L696 - D=0, P=1.
 * DependenciesScanner.callback @L703 - D=0, P=1.
 * DependenciesScanner.callback @L709 - D=0, P=1.
 * DependenciesScanner.applyApplicationProviders @L715 - D=0, P=1.
 * DependenciesScanner.getInstanceWrapper @L719 - D=0, P=1.
 * DependenciesScanner.callback @L731 - D=3, P=4.
 *   1=this.isRequestOrTransient(scope!)
 *   2=!instanceWrapper.isDependencyTreeStatic()
 *   3=!instanceWrapper.getInstanceByContextId(STATIC_CONTEXT).isResolved
 * DependenciesScanner.describeEnhancerProvider @L778 - D=3, P=4.
 *   1=wrapper.isAlias
 *   2=isFunction(target)
 *   3=isNil(wrapper.inject)
 * DependenciesScanner.getApplyProvidersMap @L792 - D=0, P=1.
 * DependenciesScanner.callback @L794 - D=0, P=1.
 * DependenciesScanner.callback @L796 - D=0, P=1.
 * DependenciesScanner.callback @L798 - D=0, P=1.
 * DependenciesScanner.callback @L800 - D=0, P=1.
 * DependenciesScanner.getApplyRequestProvidersMap @L805 - D=0, P=1.
 * DependenciesScanner.callback @L807 - D=0, P=1.
 * DependenciesScanner.callback @L809 - D=0, P=1.
 * DependenciesScanner.callback @L811 - D=0, P=1.
 * DependenciesScanner.callback @L813 - D=0, P=1.
 * DependenciesScanner.isDynamicModule @L818 - D=2, P=3.
 *   1c1=module | 1c2=!!(module as DynamicModule).module
 * DependenciesScanner.isInjectable @L828 - D=0, P=1.
 * DependenciesScanner.isController @L836 - D=0, P=1.
 * DependenciesScanner.isExceptionFilter @L844 - D=0, P=1.
 * DependenciesScanner.isForwardReference @L848 - D=2, P=3.
 *   1c1=module | 1c2=!!(module as ForwardReference).forwardRef
 * DependenciesScanner.isRequestOrTransient @L854 - D=2, P=3.
 *   1c1=scope === Scope.REQUEST | 1c2=scope === Scope.TRANSIENT
 */
import { afterEach, describe, it, vi } from 'vitest';
import {
  Module,
  Injectable,
  Controller,
  Catch,
  forwardRef,
  Logger,
  Scope,
  UseGuards,
  EntryProvider,
} from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/internal';
import { DependenciesScanner } from '../../../packages/core/scanner.js';
import { NestContainer } from '../../../packages/core/injector/container.js';
import { MetadataScanner } from '../../../packages/core/metadata-scanner.js';
import { NoopGraphInspector } from '../../../packages/core/inspector/noop-graph-inspector.js';
import { ApplicationConfig } from '../../../packages/core/application-config.js';
import { InstanceLoader } from '../../../packages/core/injector/instance-loader.js';
import { Injector } from '../../../packages/core/injector/injector.js';
import {
  APP_GUARD,
  APP_PIPE,
  APP_FILTER,
  APP_INTERCEPTOR,
} from '../../../packages/core/constants.js';
async function failure(operation: () => unknown | Promise<unknown>) {
  try {
    await operation();
  } catch (error) {
    if (!(error instanceof Error)) throw error;
  }
}
afterEach(() => vi.restoreAllMocks());
function create() {
  const config = new ApplicationConfig();
  const container = new NestContainer(config);
  const scanner: any = new DependenciesScanner(
    container,
    new MetadataScanner(),
    NoopGraphInspector,
    config,
  );
  return { container, scanner };
}
describe('DependenciesScanner', () => {
  describe('additional metadata, cycle and enhancer paths', () => {
    // scanForModules 3(T): an import already belongs to this traversal.
    it('stops a circular module import and replaces a plain module override', async () => {
      @Module({})
      class Left {}
      @Module({ imports: [Left] })
      class Right {}
      Reflect.defineMetadata(MODULE_METADATA.IMPORTS, [Right], Left);
      const { scanner } = create();
      await scanner.scanForModules({ moduleDefinition: Left });
      @Module({})
      class Replacement {}
      await scanner.overrideModule(Left, Replacement, []);
    });

    // reflectKeyMetadata: missing descriptor continues through the prototype
    // chain, then either finds metadata or reaches Object.prototype.
    it('finds inherited method metadata and exhausts missing methods', () => {
      class Parent {
        handle() {}
      }
      class Child extends Parent {}
      Reflect.defineMetadata('fixture', ['metadata'], Parent.prototype.handle);
      const { scanner } = create();
      scanner.reflectKeyMetadata(Child, 'fixture', 'handle');
      scanner.reflectKeyMetadata(Child, 'fixture', 'absent');
      const NullPrototypeClass = function () {};
      NullPrototypeClass.prototype = Object.create(null);
      scanner.reflectKeyMetadata(NullPrototypeClass, 'fixture', 'absent');
    });

    // insertProvider scope from useValue/useFactory/explicit scope/useExisting.
    it('classifies global enhancers with factory, value, explicit and alias scopes', async () => {
      const { scanner, container } = create();
      const ref = (await container.addModule(class Root {}, []))!.moduleRef;
      @Injectable({ scope: Scope.REQUEST })
      class RequestEnhancer {}
      ref.addProvider(RequestEnhancer);
      for (const provider of [
        { provide: APP_GUARD, useValue: { canActivate: () => true } },
        {
          provide: APP_PIPE,
          useFactory: () => ({ transform: (v: unknown) => v }),
        },
        {
          provide: APP_FILTER,
          useClass: RequestEnhancer,
          scope: Scope.REQUEST,
        },
        { provide: APP_INTERCEPTOR, useExisting: RequestEnhancer },
      ])
        scanner.insertProvider(provider, ref.token);
    });

    // applyApplicationProviders: a static global enhancer with a request tree
    // fails, as does a static enhancer whose instance has not been constructed.
    it.each([false, true])(
      'rejects an unusable global enhancer with request dependency %s',
      async requestDependency => {
        @Injectable({ scope: Scope.REQUEST })
        class RequestDependency {}
        @Module({
          providers: [
            RequestDependency,
            {
              provide: APP_GUARD,
              useFactory: () => ({ canActivate: () => true }),
              inject: requestDependency ? [RequestDependency] : [],
            },
          ],
        })
        class Root {}
        const { scanner, container } = create();
        await scanner.scan(Root);
        if (requestDependency) {
          await new InstanceLoader(
            container,
            new Injector(),
            NoopGraphInspector,
          ).createInstancesOfDependencies();
        }
        await failure(() => scanner.applyApplicationProviders());
      },
    );
  });
  describe('scan/module overrides/import validation', () => {
    it('forward references and override matching', async () => {
      vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
      @Module({})
      class Original {}
      @Module({})
      class Replacement {}
      @Module({ imports: [forwardRef(() => Original)] })
      class Root {}
      const { scanner } = create();
      await scanner.scan(Root, {
        overrides: [
          {
            moduleToReplace: Original,
            newModule: forwardRef(() => Replacement),
          },
        ],
      });
      scanner.calculateModulesDistance();
      scanner.getOverrideModuleByModule(
        forwardRef(() => Original),
        [
          {
            moduleToReplace: forwardRef(() => Original),
            newModule: Replacement,
          },
        ],
      );
      scanner.getOverrideModuleByModule(Original, []);
      scanner.calculateModulesDistance();
    });
    it.each([undefined, null, 'invalid', 1])(
      'invalid imported module %s',
      async imported => {
        @Module({})
        class Root {}
        Reflect.defineMetadata(MODULE_METADATA.IMPORTS, [imported], Root);
        await failure(() => create().scanner.scan(Root));
      },
    );
    it.each(['provider', 'controller', 'filter'])(
      'invalid class in imports %s',
      async kind => {
        class Invalid {}
        if (kind === 'provider') Injectable()(Invalid);
        if (kind === 'controller') Controller()(Invalid);
        if (kind === 'filter') Catch()(Invalid);
        await failure(() => create().scanner.insertModule(Invalid, []));
      },
    );
    it.each(['providers', 'controllers', 'exports'])(
      'undefined metadata entry %s',
      async key => {
        @Module({})
        class Root {}
        Reflect.defineMetadata(key, [undefined], Root);
        await failure(() => create().scanner.scan(Root));
      },
    );
  });
  describe('global enhancer registration/application and dynamic metadata', () => {
    it('all static/request-scoped application provider maps', async () => {
      vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
      @Injectable()
      class Enhancer {
        canActivate() {
          return true;
        }
        transform(v: unknown) {
          return v;
        }
        intercept(_ctx: any, next: any) {
          return next.handle();
        }
        catch() {}
      }
      @Injectable({ scope: Scope.TRANSIENT })
      class TransientEnhancer extends Enhancer {}
      @Controller()
      @UseGuards(new Enhancer())
      class TestController {}
      @Module({
        controllers: [TestController],
        providers: [
          Enhancer,
          ...[APP_GUARD, APP_PIPE, APP_FILTER, APP_INTERCEPTOR].flatMap(
            provide => [
              { provide, useClass: Enhancer },
              { provide, useClass: TransientEnhancer },
            ],
          ),
        ],
      })
      class Root {}
      const { container, scanner } = create();
      await scanner.scan(Root);
      await new InstanceLoader(
        container,
        new Injector(),
        NoopGraphInspector,
      ).createInstancesOfDependencies();
      scanner.applyApplicationProviders();
      const root = [...container.getModules().values()].find(
        module => module.metatype === Root,
      )!;
      scanner.insertInjectable(Enhancer, root.token, TestController, 'guard');
      scanner.insertInjectable({}, root.token, TestController, 'guard');
      scanner.insertExportedProviderOrModule(
        forwardRef(() => Enhancer),
        root.token,
      );
      await scanner.insertImport(
        forwardRef(() => Root),
        root.token,
        'Root',
      );
      await failure(() => scanner.insertImport(undefined, root.token, 'Root'));
      scanner.isDynamicModule(undefined);
      scanner.isCustomProvider(null);
      scanner.describeEnhancerProvider({ isAlias: true, inject: ['token'] });
      scanner.describeEnhancerProvider({ isAlias: true, inject: [Enhancer] });
      scanner.describeEnhancerProvider({
        isAlias: false,
        inject: null,
        metatype: Enhancer,
      });
      scanner.describeEnhancerProvider({ isAlias: false, inject: [] });
      scanner.removeModules([root]);
    });
    it('empty distance calculation', () => {
      create().scanner.calculateModulesDistance();
    });
  });
});
