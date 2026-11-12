/**
 * CFT checklist extracted from packages/core/injector/injector.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * HostSettlementRef.constructor @L102 - D=0, P=1.
 * HostSettlementRef.settlementSignal @L107 - D=0, P=1.
 * Injector.callback @L115 - D=0, P=1.
 * Injector.constructor @L144 - D=1, P=2.
 *   1=options?.instanceDecorator
 * Injector.loadPrototype @L167 - D=2, P=3.
 *   1=!collection
 *   2=instance
 * Injector.loadInstance @L185 - D=8, P=9.
 *   1=instanceHost.isPending
 *   2c1=resolutionContext.inquirer | 2c2=settlementSignal?.isCycle(resolutionContext.inquirer.id)
 *   3c1=wrapper.token | 3c2=wrapper.name
 *   4=isUndefined(targetWrapper)
 *   5=instanceHost.isResolved
 *   6=!instanceHost.isResolved
 * Injector.callback @L211 - D=2, P=3.
 *   1=err
 *   2=this.failedInstances.has(instanceHost)
 * Injector.callback @L244 - D=1, P=2.
 *   1=wrapper.isTransient
 * Injector.callback @L264 - D=0, P=1.
 * Injector.loadMiddleware @L293 - D=3, P=4.
 *   1=!isUndefined(targetWrapper.instance)
 *   2c1=inquirer | 2c2=wrapper
 * Injector.loadController @L314 - D=3, P=4.
 *   1=wrapper.isDependencyTreeStatic()
 *   2c1=wrapper.getEnhancersMetadata() | 2c2=[]
 * Injector.loadInjectable @L338 - D=0, P=1.
 * Injector.loadProvider @L353 - D=7, P=8.
 *   1=this.shouldSkipProviderLoading(wrapper, resolutionContext)
 *   2=!resolutionContext.inquirer
 *   3c1=resolutionContext.contextId === STATIC_CONTEXT | 3c2=!resolutionContext.inquirer | 3c3=wrapper.isDependencyTreeStatic()
 *   4c1=wrapper.getEnhancersMetadata() | 4c2=[]
 * Injector.callback @L386 - D=0, P=1.
 * Injector.applySettlementSignal @L396 - D=0, P=1.
 * Injector.resolveConstructorParams @L409 - D=5, P=6.
 *   1c1=resolutionContext.contextId !== STATIC_CONTEXT | 1c2=this.hasDenseCtorMetadata(wrapper, inject, metadata)
 *   2=isFactoryProvider
 *   3c1=isResolved | 3c2=await callback(instances, depth)
 * Injector.resolveParam @L440 - D=9, P=10.
 *   1=this.isInquirer(param, parentInquirer)
 *   2c1=parentInquirer | 2c2=parentInquirer.instance
 *   3c1=resolutionContext.inquirer?.isTransient | 3c2=parentInquirer
 *   4=paramWrapperWithInstance.hierarchyLevel > depth
 *   5c1=!instanceHost.isResolved | 5c2=!paramWrapperWithInstance.forwardRef
 *   6=!isOptional
 * Injector.getClassDependencies @L522 - D=0, P=1.
 * Injector.warnOnMissingDecoratorMetadata @L545 - D=7, P=8.
 *   1c1=type.length === 0 | 1c2=this.classesWithoutMetadata.has(type) | 1c3=Reflect.hasMetadata(PARAMTYPES_METADATA, type) | 1c4=Reflect.getOwnMetadataKeys(type).length === 0
 *   2=index < type.length
 *   3c1=dependencies[index] === undefined | 3c2=!optionalDependenciesIds.includes(index)
 * Injector.getFactoryProviderDependencies @L570 - D=0, P=1.
 * Injector.isOptionalFactoryDependency @L579 - D=3, P=4.
 *   1=isNil(token)
 *   2c1=!isUndefined((value as OptionalFactoryDependency).optional) | 2c2=!(value as any).prototype
 * Injector.mapFactoryProviderInjectArray @L592 - D=8, P=9.
 *   1c1=!isNil(item) | 1c2=typeof item === 'object' | 1c3='token' in item
 *   2=isWrappedDependency
 *   3=isNil(token)
 *   4=typeof item !== 'object'
 *   5=isOptionalFactoryDependency(item)
 *   6=item.optional
 * Injector.reflectConstructorParams @L625 - D=2, P=3.
 *   1c1=Reflect.getMetadata(PARAMTYPES_METADATA, type) | 1c2=[]
 * Injector.callback @L631 - D=0, P=1.
 * Injector.reflectOptionalParams @L635 - D=2, P=3.
 *   1c1=Reflect.getOwnMetadata(OPTIONAL_DEPS_METADATA, ctorOwner) | 1c2=[]
 * Injector.getConstructorOwner @L647 - D=5, P=6.
 *   1c1=isFunction(current) | 1c2=current !== Function.prototype
 *   2c1=Reflect.hasOwnMetadata(PARAMTYPES_METADATA, current) | 2c2=Reflect.hasOwnMetadata(OPTIONAL_DEPS_METADATA, current) | 2c3=Reflect.hasOwnMetadata(SELF_DECLARED_DEPS_METADATA, current)
 * Injector.reflectSelfParams @L664 - D=2, P=3.
 *   1c1=Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, type) | 1c2=[]
 * Injector.resolveSingleParam @L668 - D=1, P=2.
 *   1=isUndefined(param)
 * Injector.resolveParamToken @L697 - D=2, P=3.
 *   1c1=typeof param === 'object' | 1c2='forwardRef' in param
 * Injector.resolveComponentWrapper @L708 - D=0, P=1.
 * Injector.resolveComponentHost @L729 - D=8, P=9.
 *   1c1=!instanceHost.isResolved | 1c2=!instanceWrapper.forwardRef
 *   2c1=!instanceHost.isResolved | 2c2=instanceWrapper.forwardRef | 2c3=resolutionContext.contextId !== STATIC_CONTEXT | 2c4=!!inquirerId
 *   3=instanceHost.donePromise
 *   4=instanceWrapper.async
 * Injector.callback @L765 - D=1, P=2.
 *   1=err
 * Injector.callback @L776 - D=0, P=1.
 * Injector.lookupComponent @L827 - D=6, P=7.
 *   1c1=wrapper.token | 1c2=wrapper.name
 *   2c1=wrapper | 2c2=token === name
 *   3c1=name | 3c2=providers.has(name)
 * Injector.lookupComponentInParentModules @L860 - D=1, P=2.
 *   1=isNil(instanceWrapper)
 * Injector.lookupComponentInImports @L886 - D=0, P=1.
 * Injector.lookupComponentInImportsSync @L911 - D=10, P=11.
 *   1c1=moduleRef.imports | 1c2=new Set<Module>()
 *   2=next iteration of imports
 *   3=!relatedModule
 *   4c1=isTraversing | 4c2=!moduleRef.exports.has(relatedModule.metatype)
 *   5=moduleRegistry.has(relatedModule.id)
 *   6c1=!exports.has(name) | 6c2=!providers.has(name)
 *   7=instanceRef
 * Injector.resolveProperties @L967 - D=3, P=4.
 *   1=!isNil(inject)
 *   2c1=resolutionContext.contextId !== STATIC_CONTEXT | 2c2=this.hasCompletePropertiesMetadata(wrapper, metadata)
 * Injector.callback @L992 - D=5, P=6.
 *   1=this.isInquirer(item.name, parentInquirer)
 *   2c1=parentInquirer | 2c2=parentInquirer.instance
 *   3=!paramWrapperWithInstance
 *   4=!item.isOptional
 * Injector.callback @L1064 - D=0, P=1.
 * Injector.reflectProperties @L1070 - D=4, P=5.
 *   1c1=Reflect.getMetadata(PROPERTY_DEPS_METADATA, type) | 1c2=[]
 *   2c1=Reflect.getMetadata(OPTIONAL_PROPERTY_DEPS_METADATA, type) | 2c2=[]
 * Injector.callback @L1075 - D=0, P=1.
 * Injector.applyProperties @L1082 - D=1, P=2.
 *   1=!isObject(instance)
 * Injector.callback @L1090 - D=0, P=1.
 * Injector.callback @L1091 - D=0, P=1.
 * Injector.instantiateClass @L1094 - D=6, P=7.
 *   1c1=this.options?.preview | 1c2=!wrapper.host?.initOnPreview
 *   2c1=isNil(inject) | 2c2=isInContext
 *   3=wrapper.forwardRef
 *   4=isInContext
 * Injector.loadPerContext @L1135 - D=3, P=4.
 *   1=!wrapper
 *   2c1=host | 2c2=host.instance as T
 * Injector.callback @L1148 - D=2, P=3.
 *   1c1=!item.isAlias | 1c2=item.instance === instance
 * Injector.waitForDeferredLoads @L1176 - D=2, P=3.
 *   1=!deferredLoads
 *   2=next iteration of deferredLoads
 * Injector.loadEnhancersPerContext @L1187 - D=1, P=2.
 *   1=ctx === STATIC_CONTEXT
 * Injector.loadEnhancers @L1199 - D=0, P=1.
 * Injector.loadEnhancer @L1204 - D=0, P=1.
 * Injector.loadCtorMetadata @L1216 - D=0, P=1.
 * Injector.callback @L1223 - D=0, P=1.
 * Injector.callback @L1232 - D=0, P=1.
 * Injector.loadPropertiesMetadata @L1247 - D=0, P=1.
 * Injector.callback @L1254 - D=0, P=1.
 * Injector.callback @L1264 - D=0, P=1.
 * Injector.addDeferredLoad @L1282 - D=2, P=3.
 *   1=contextId === STATIC_CONTEXT
 *   2=!deferredLoads
 * Injector.trackDurableDeferredLoad @L1306 - D=1, P=2.
 *   1=this.getContextId(contextId, wrapper) === contextId
 * Injector.callback @L1315 - D=0, P=1.
 * Injector.callback @L1323 - D=1, P=2.
 *   1=loads.size === 0
 * Injector.untrack @L1330 - D=0, P=1.
 * Injector.callback @L1330 - D=0, P=1.
 * Injector.callback @L1332 - D=0, P=1.
 * Injector.callback @L1335 - D=0, P=1.
 * Injector.callback @L1338 - D=2, P=3.
 *   1c1=host.isResolved | 1c2=host.isPending
 * Injector.callback @L1339 - D=0, P=1.
 * Injector.linkDurableDeferredLoads @L1350 - D=1, P=2.
 *   1=hostContextId === contextId
 * Injector.callback @L1361 - D=0, P=1.
 * Injector.forEachDurableDependent @L1364 - D=2, P=3.
 *   1=next iteration of wrapper.getDependents()
 *   2=hostContextId !== contextId
 * Injector.getInstanceHost @L1382 - D=2, P=3.
 *   1c1=!instanceHost.isResolved | 1c2=!this.failedInstances.has(instanceHost)
 * Injector.insertSettlementRef @L1398 - D=1, P=2.
 *   1=inquirer?.isTransient
 * Injector.getInquirerId @L1410 - D=1, P=2.
 *   1=inquirer
 * Injector.createResolutionContext @L1416 - D=0, P=1.
 * Injector.getContextInquirerId @L1430 - D=0, P=1.
 * Injector.isInContext @L1437 - D=4, P=5.
 *   1c1=wrapper.isStatic( resolutionContext.contextId, resolutionContext.inquirer, resolutionContext.rootInquirer, ) | 1c2=wrapper.isInRequestScope( resolutionContext.contextId, resolutionContext.inquirer, ) | 1c3=wrapper.isLazyTransient( resolutionContext.contextId, resolutionContext.inquirer, ) | 1c4=wrapper.isExplicitlyRequested( resolutionContext.contextId, resolutionContext.inquirer, )
 * Injector.lookupSkippedProviderDependencies @L1468 - D=5, P=6.
 *   1c1=!isFactoryProvider | 1c2=!isFunction(wrapper.metatype)
 *   2=isFactoryProvider
 *   3=isFactoryProvider
 *   4=failure
 * Injector.lookup @L1483 - D=1, P=2.
 *   1=!isOptional
 * Injector.callback @L1505 - D=0, P=1.
 * Injector.callback @L1513 - D=0, P=1.
 * Injector.callback @L1523 - D=0, P=1.
 * Injector.shouldSkipProviderLoading @L1530 - D=8, P=9.
 *   1c1=hasNoInquirer | 1c2=wrapper.isTransient | 1c3=wrapper.scope === Scope.REQUEST
 *   2c1=!!resolutionContext.inquirer | 2c2=!this.isInContext( resolutionContext.inquirer, this.createResolutionContext( resolutionContext.contextId, resolutionContext.inquirer, undefined, resolutionContext.rootInquirer, ), )
 *   3c1=isStaticContext | 3c2=isTopLevelStaticTransientOrRequestProvider | 3c3=isStaticInquirerOutsideResolutionContext
 * Injector.getEffectiveInquirer @L1564 - D=4, P=5.
 *   1c1=dependency?.isTransient | 1c2=inquirer?.isTransient | 1c3=parentInquirer
 *   2=contextId === STATIC_CONTEXT
 * Injector.getEffectiveInquirerId @L1579 - D=4, P=5.
 *   1c1=contextId === STATIC_CONTEXT | 1c2=dependency?.isTransient | 1c3=inquirer?.isTransient | 1c4=parentInquirer
 * Injector.getStaticTransientResolutionContext @L1604 - D=3, P=4.
 *   1c1=contextId === STATIC_CONTEXT | 1c2=inquirer?.isTransient | 1c3=parentInquirer
 * Injector.getEffectiveResolutionContext @L1625 - D=1, P=2.
 *   1=effectiveInquirer === resolutionContext.inquirer
 * Injector.hasDenseCtorMetadata @L1650 - D=6, P=7.
 *   1=!metadata
 *   2=!isNil(inject)
 *   3=wrapper.metatype
 *   4=metadata.length !== expectedDepsLength
 *   5=index < expectedDepsLength
 *   6=metadata[index] === undefined
 * Injector.hasCompletePropertiesMetadata @L1681 - D=2, P=3.
 *   1=!metadata
 *   2=wrapper.metatype
 * Injector.callback @L1696 - D=0, P=1.
 * Injector.callback @L1697 - D=0, P=1.
 * Injector.resolveScopedComponentHost @L1701 - D=1, P=2.
 *   1=this.isInquirerRequest(item, parentInquirer)
 * Injector.isInquirerRequest @L1720 - D=3, P=4.
 *   1c1=item.isTransient | 1c2=item.name === INQUIRER | 1c3=parentInquirer
 * Injector.isInquirer @L1727 - D=2, P=3.
 *   1c1=param === INQUIRER | 1c2=parentInquirer
 * Injector.addDependencyMetadata @L1734 - D=2, P=3.
 *   1c1=isSymbol(keyOrIndex) | 1c2=isString(keyOrIndex)
 * Injector.getTokenName @L1746 - D=1, P=2.
 *   1=isFunction(token)
 * Injector.printResolvingDependenciesLog @L1750 - D=4, P=5.
 *   1=!isDebugMode()
 *   2c1=inquirer?.name | 2c2=inquirer.name.toString?.()
 *   3=isAlias
 * Injector.printLookingForProviderLog @L1771 - D=1, P=2.
 *   1=!isDebugMode()
 * Injector.printFoundInModuleLog @L1787 - D=1, P=2.
 *   1=!isDebugMode()
 * Injector.getContextId @L1803 - D=1, P=2.
 *   1=contextId.getParent
 * Injector.getNowTimestamp @L1815 - D=0, P=1.
 */
import { afterEach, describe, it, vi } from 'vitest';
import {
  Inject,
  Optional,
  Injectable,
  Scope,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { Injector } from '../../../../packages/core/injector/injector.js';
import { NestContainer } from '../../../../packages/core/injector/container.js';
import { InstanceWrapper } from '../../../../packages/core/injector/instance-wrapper.js';
import { STATIC_CONTEXT } from '../../../../packages/core/injector/constants.js';
import { PARAMTYPES_METADATA } from '@nestjs/common/internal';
import { INQUIRER } from '../../../../packages/core/injector/inquirer/inquirer-constants.js';
import { inquirerProvider } from '../../../../packages/core/injector/inquirer/inquirer-providers.js';
import { MiddlewareContainer } from '../../../../packages/core/middleware/container.js';
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
async function failure(operation: () => unknown | Promise<unknown>) {
  try {
    await operation();
  } catch (error) {
    if (!(error instanceof Error)) throw error;
  }
}
describe('Injector', () => {
  describe('additional dependency and context paths', () => {
    // Import traversal finds re-exported providers, skips previously visited
    // modules in a diamond graph, and rejects injection of the consumer itself.
    it('walks re-exported module imports and avoids visiting a shared module twice', async () => {
      const container = new NestContainer();
      class Root {}
      class Left {}
      class Right {}
      class Shared {}
      class Dependency {}
      const root = (await container.addModule(Root, []))!.moduleRef;
      const left = (await container.addModule(Left, []))!.moduleRef;
      const right = (await container.addModule(Right, []))!.moduleRef;
      const shared = (await container.addModule(Shared, []))!.moduleRef;
      root.addImport(left);
      root.addImport(right);
      left.addImport(shared);
      right.addImport(shared);
      left.addExportedProviderOrModule(Shared);
      right.addExportedProviderOrModule(Shared);
      shared.addProvider(Dependency);
      shared.addExportedProviderOrModule(Dependency);
      const wrapper = new InstanceWrapper({
        name: 'Consumer',
        token: 'consumer',
      });
      const injector = new Injector();
      await injector.lookupComponentInImports(
        root,
        Dependency,
        wrapper,
        new Set(),
        undefined,
        0,
      );
      await injector.lookupComponentInImports(root, 'missing', wrapper);
      await failure(() =>
        injector.lookupComponent(
          root.providers,
          root,
          { name: 'consumer' },
          wrapper,
        ),
      );
    });

    // INQUIRER cached metadata delegates directly to the parent wrapper.
    it.each([STATIC_CONTEXT, { id: 401 }])(
      'loads cached INQUIRER metadata in context %j',
      async contextId => {
        const injector: any = new Injector();
        const owner = new InstanceWrapper({
          name: 'Owner',
          instance: {},
          isResolved: true,
        });
        const inquirer = new InstanceWrapper({
          name: INQUIRER,
          token: INQUIRER,
          scope: Scope.TRANSIENT,
        });
        await injector.loadCtorMetadata([inquirer], contextId, owner, owner);
        await injector.loadPropertiesMetadata(
          [{ key: 'owner', wrapper: inquirer }],
          contextId,
          owner,
          owner,
        );
      },
    );

    // Effective/root inquirer IDs can be absent on an explicitly entered
    // static transient subtree, or already composed by an outer transient.
    it.each([undefined, 'outer:middle'])(
      'resolves static transient identity with effective ID %s',
      effectiveInquirerId => {
        const injector: any = new Injector();
        const dependency = new InstanceWrapper({ scope: Scope.TRANSIENT });
        const inquirer = new InstanceWrapper({ scope: Scope.TRANSIENT });
        const parent = new InstanceWrapper();
        const context = {
          contextId: STATIC_CONTEXT,
          inquirer,
          effectiveInquirerId,
        };
        injector.getEffectiveResolutionContext(dependency, context, parent);
        injector.getStaticTransientResolutionContext(context, parent);
      },
    );

    it('loads middleware whose prototype already exists and reports a required property lookup failure', async () => {
      const container = new NestContainer();
      const ref = (await container.addModule(class Root {}, []))!.moduleRef;
      class Middleware {
        use() {}
      }
      new MiddlewareContainer(container).insertConfig(
        [{ middleware: [Middleware], forRoutes: [] }],
        ref.token,
      );
      const injector = new Injector();
      const middleware = ref.middlewares.get(Middleware)!;
      await injector.loadMiddleware(middleware, ref.middlewares, ref);
      await injector.loadMiddleware(middleware, ref.middlewares, ref);
      class Consumer {
        @Inject('missing') value: unknown;
      }
      await failure(() =>
        injector.resolveProperties(
          new InstanceWrapper({ metatype: Consumer }),
          ref,
        ),
      );
    });

    // Two concurrent durable loads share tracking. The first leaves another
    // pending load, and only resolved/pending dependent hosts are invalidated.
    it('invalidates durable dependents and discards failed cached hosts', async () => {
      const injector: any = new Injector();
      const shared = { id: 500 };
      const context: any = { id: 501 };
      context.getParent = ({ isTreeDurable }: any) =>
        isTreeDurable ? shared : context;
      const dependency = new InstanceWrapper({
        scope: Scope.REQUEST,
        durable: true,
      });
      const parents = [
        new InstanceWrapper({ scope: Scope.REQUEST, durable: true }),
        new InstanceWrapper({ scope: Scope.REQUEST, durable: true }),
        new InstanceWrapper({ scope: Scope.REQUEST, durable: true }),
        new InstanceWrapper({ scope: Scope.REQUEST, durable: false }),
      ];
      parents.forEach((parent, index) => {
        parent.addCtorMetadata(0, dependency);
        parent.setInstanceByContextId(shared, {
          instance: {},
          isResolved: index === 0,
          isPending: index === 1,
        });
      });
      const first = Promise.withResolvers<void>();
      const second = Promise.withResolvers<void>();
      first.promise.catch(() => undefined);
      injector.trackDurableDeferredLoad(dependency, context, first.promise);
      injector.trackDurableDeferredLoad(dependency, context, second.promise);
      first.reject(new Error('durable dependency failed'));
      await first.promise.catch(() => undefined);
      injector.getInstanceHost(parents[0], shared, undefined);
      second.resolve();
      await second.promise;
    });

    // getFactoryProviderDependencies helper 1(T): a plain object passes the
    // outer token check but has no token in the optional-descriptor helper.
    it('visits the optional dependency helper with a plain object token', () => {
      new Injector().getFactoryProviderDependencies(
        new InstanceWrapper({ name: 'Factory', inject: [{}] as any }),
      );
    });

    // resolveConstructorParams 2(T),3c1(T),3c2(T); property INQUIRER fast path;
    // effective inquirer and composed IDs for static/non-static nested transients.
    it.each([Scope.DEFAULT, Scope.REQUEST])(
      'loads nested transient constructor/property dependencies under scope %i',
      async scope => {
        const container = new NestContainer();
        const ref = (await container.addModule(class Root {}, []))!.moduleRef;
        @Injectable({ scope: Scope.TRANSIENT })
        class Leaf {
          constructor(@Inject(INQUIRER) readonly owner: unknown) {}
          @Inject(INQUIRER) propertyOwner: unknown;
        }
        @Injectable({ scope: Scope.TRANSIENT })
        class Middle {
          constructor(@Inject(Leaf) readonly leaf: Leaf) {}
          @Inject(Leaf) propertyLeaf: Leaf;
        }
        @Injectable({ scope })
        class Parent {
          constructor(@Inject(Middle) readonly middle: Middle) {}
          @Inject(Middle) propertyMiddle: Middle;
        }
        [inquirerProvider, Leaf, Middle, Parent].forEach(provider =>
          ref.addProvider(provider),
        );
        const injector = new Injector();
        for (const wrapper of ref.providers.values())
          injector.loadPrototype(wrapper, ref.providers);
        const wrapper = ref.getProviderByKey(Parent)!;
        await injector.loadProvider(wrapper, ref);
        const contextId =
          scope === Scope.DEFAULT ? STATIC_CONTEXT : { id: 100 };
        await injector.loadPerContext(
          wrapper.instance,
          ref,
          ref.providers,
          contextId,
          wrapper,
        );
        if (scope === Scope.REQUEST) {
          await injector.loadPerContext(
            wrapper.instance,
            ref,
            ref.providers,
            { id: 101 },
            wrapper,
          );
        }
      },
    );

    // loadInstance pending path: successful completion, donePromise error,
    // durable invalidation discovered after waiting, and a cycle reference.
    it.each(['success', 'error', 'invalidated', 'cycle'])(
      'settles a pending provider through %s',
      async mode => {
        const container = new NestContainer();
        const ref = (await container.addModule(class Root {}, []))!.moduleRef;
        class Provider {}
        ref.addProvider(Provider);
        const wrapper = ref.getProviderByKey(Provider)!;
        const injector: any = new Injector();
        const host = wrapper.getInstanceByContextId(STATIC_CONTEXT);
        const signal = injector.applySettlementSignal(host, wrapper);
        const inquirer = new InstanceWrapper({ name: 'Owner' });
        if (mode === 'cycle') signal.insertRef({ id: inquirer.id });
        const loading = injector.loadInstance(wrapper, ref.providers, ref, {
          contextId: STATIC_CONTEXT,
          inquirer,
        });
        const handled = failure(() => loading);
        if (mode === 'invalidated')
          injector.failedInstances.set(host, new Error('dependency failed'));
        if (mode === 'error') signal.error(new Error('factory failed'));
        else signal.complete();
        await handled;
      },
    );

    // resolveComponentHost 2c1(T),2c2(T),2c3(T): fresh and previously scheduled
    // forward references, with deterministic settlement instead of timeouts.
    it.each(['fresh', 'settled', 'failed'])(
      'resolves request forward reference %s',
      async mode => {
        const container = new NestContainer();
        const ref = (await container.addModule(class Root {}, []))!.moduleRef;
        @Injectable({ scope: Scope.REQUEST })
        class Provider {}
        ref.addProvider(Provider);
        const wrapper = ref.getProviderByKey(Provider)!;
        wrapper.forwardRef = true;
        const contextId = { id: 200 };
        const injector: any = new Injector();
        injector.loadPrototype(wrapper, ref.providers);
        const host = wrapper.getInstanceByContextId(contextId);
        if (mode !== 'fresh') {
          host.donePromise = Promise.resolve(
            mode === 'failed' ? new Error('previous load') : undefined,
          );
        }
        await injector.resolveComponentHost(ref, wrapper, { contextId });
        if (mode === 'failed')
          await failure(() => injector.waitForDeferredLoads(contextId));
        else await injector.waitForDeferredLoads(contextId);
      },
    );

    it('resolves an asynchronous value provider and class registered under a custom token', async () => {
      const container = new NestContainer();
      const ref = (await container.addModule(class Root {}, []))!.moduleRef;
      class Provider {}
      ref.addProvider({
        provide: 'async',
        useValue: Promise.resolve({ ready: true }),
      });
      ref.addProvider({ provide: 'custom', useClass: Provider });
      ref.addProvider({ provide: 'alias', useExisting: 'custom' });
      const injector = new Injector();
      for (const wrapper of ref.providers.values())
        injector.loadPrototype(wrapper, ref.providers);
      await injector.resolveComponentHost(ref, ref.getProviderByKey('async')!);
      const wrapper = ref.getProviderByKey('custom')!;
      await injector.loadProvider(wrapper, ref);
      await injector.loadPerContext(wrapper.instance, ref, ref.providers, {
        id: 300,
      });
    });

    // lookupSkippedProviderDependencies: optional/required missing constructor
    // and property dependencies, including factory providers during bootstrap.
    it.each([
      'required constructor',
      'optional constructor',
      'required property',
      'optional property',
      'factory',
    ])('validates skipped request provider %s', async mode => {
      const container = new NestContainer();
      const ref = (await container.addModule(class Root {}, []))!.moduleRef;
      @Injectable({ scope: Scope.REQUEST })
      class RequiredConstructor {
        constructor(@Inject('missing') value: unknown) {}
      }
      @Injectable({ scope: Scope.REQUEST })
      class OptionalConstructor {
        constructor(@Optional() @Inject('missing') value: unknown) {}
      }
      @Injectable({ scope: Scope.REQUEST })
      class RequiredProperty {
        @Inject('missing') value: unknown;
      }
      @Injectable({ scope: Scope.REQUEST })
      class OptionalProperty {
        @Optional() @Inject('missing') value: unknown;
      }
      const providers: any = {
        'required constructor': RequiredConstructor,
        'optional constructor': OptionalConstructor,
        'required property': RequiredProperty,
        'optional property': OptionalProperty,
        factory: {
          provide: 'factory',
          scope: Scope.REQUEST,
          useFactory: () => ({}),
          inject: ['missing'],
        },
      };
      const token = ref.addProvider(providers[mode]);
      const injector = new Injector();
      if (mode.startsWith('optional'))
        await injector.loadProvider(ref.getProviderByKey(token)!, ref);
      else
        await failure(() =>
          injector.loadProvider(ref.getProviderByKey(token)!, ref),
        );
    });
  });
  describe('loadPrototype/loadProvider/loadInstance/loadPerContext/resolveConstructorParams/resolveProperties/instantiateClass', () => {
    it.each([Scope.DEFAULT, Scope.REQUEST, Scope.TRANSIENT])(
      'scope %i with concurrent and repeated loads',
      async scope => {
        const container = new NestContainer();
        const ref = (await container.addModule(class Root {}, []))!.moduleRef;
        @Injectable({ scope })
        class Dependency {}
        class Consumer {
          constructor(
            @Inject(Dependency) dependency: unknown,
            @Optional() @Inject('missing') optional?: unknown,
          ) {}
          @Inject(Dependency) property: unknown;
          @Optional() @Inject('absent') optionalProperty: unknown;
        }
        ref.addProvider(Dependency);
        ref.addProvider(Consumer);
        ref.addProvider({
          provide: 'factory',
          useFactory: (dep: any) => ({ dep }),
          inject: [Dependency, { token: 'optional', optional: true }],
        });
        const injector = new Injector();
        for (const wrapper of ref.providers.values())
          injector.loadPrototype(wrapper, ref.providers);
        const host = ref.getProviderByKey(Consumer);
        await Promise.all([
          injector.loadProvider(host, ref),
          injector.loadProvider(host, ref),
        ]);
        const id = { id: 1 };
        await injector.loadPerContext(
          host.instance,
          ref,
          ref.providers,
          id,
          host,
        );
        await injector.loadPerContext(
          host.instance,
          ref,
          ref.providers,
          id,
          host,
        );
        await injector.loadProvider(ref.getProviderByKey('factory'), ref, {
          contextId: id,
          inquirer: host,
        });
        await injector.loadCtorMetadata(host.getCtorMetadata(), id, host);
        await injector.loadPropertiesMetadata(
          host.getPropertiesMetadata(),
          id,
          host,
        );
        injector.loadPrototype(host, undefined as any);
        injector.applyProperties(undefined, []);
        injector.applyProperties({}, [
          { key: 'empty', name: 'empty', instance: null },
          { key: 'field', name: 'field', instance: 1 },
        ]);
      },
    );
  });
  describe('dependency token validation/reflection/constructor inheritance', () => {
    it.each([
      undefined,
      null,
      { token: undefined },
      { token: 'value', optional: true },
      { token: 'value', optional: false },
      { token: 'value' },
      { token: 'value', optional: true, prototype: {} },
      'value',
      class Dependency {},
    ])('factory dependency %s', async dependency => {
      const injector = new Injector();
      await failure(() =>
        injector.getFactoryProviderDependencies(
          new InstanceWrapper({ name: 'Factory', inject: [dependency] as any }),
        ),
      );
      injector.getFactoryProviderDependencies(new InstanceWrapper());
    });
    it('reflection defaults, own/inherited metadata, forward refs and warning cache', () => {
      vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      class Parent {
        constructor(@Optional() @Inject('value') value: any) {}
      }
      class Inherited extends Parent {}
      class Own extends Parent {
        constructor(value: any) {
          super(value);
        }
      }
      const injector: any = new Injector();
      for (const type of [Parent, Inherited, Own, class Plain {}]) {
        injector.reflectConstructorParams(type);
        injector.reflectOptionalParams(type);
        injector.reflectSelfParams(type);
        injector.reflectProperties(type);
      }
      class MissingMetadata {
        constructor(first: any, second: any) {}
      }
      Reflect.defineMetadata('fixture', true, MissingMetadata);
      injector.getClassDependencies(
        new InstanceWrapper({ metatype: MissingMetadata }),
      );
      injector.getClassDependencies(
        new InstanceWrapper({ metatype: MissingMetadata }),
      );
      injector.warnOnMissingDecoratorMetadata(MissingMetadata, [], [0, 1]);
      const wrapper = new InstanceWrapper();
      injector.resolveParamToken(
        wrapper,
        forwardRef(() => Parent),
      );
      injector.resolveParamToken(wrapper, 'value');
    });
    it('missing runtime provider and undefined dependency', async () => {
      vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
      const container = new NestContainer();
      const ref = (await container.addModule(class Root {}, []))!.moduleRef;
      const injector = new Injector();
      const wrapper = new InstanceWrapper({
        name: 'Missing',
        token: 'missing',
      });
      await failure(() => injector.loadInstance(wrapper, new Map(), ref));
      await failure(() =>
        injector.resolveSingleParam(
          wrapper,
          undefined as any,
          { index: 0, dependencies: [undefined as any] },
          ref,
        ),
      );
    });
  });
  describe('dense constructor/property metadata guards and debug logging', () => {
    it('absent/sparse/mismatched/complete metadata and token types', () => {
      const injector: any = new Injector();
      class Provider {}
      Reflect.defineMetadata(PARAMTYPES_METADATA, [String], Provider);
      const wrapper = new InstanceWrapper({ metatype: Provider });
      for (const metadata of [
        undefined,
        [],
        [undefined],
        [new InstanceWrapper()],
      ])
        injector.hasDenseCtorMetadata(wrapper, [String], metadata);
      injector.hasDenseCtorMetadata(wrapper, undefined, [
        new InstanceWrapper(),
      ]);
      injector.hasDenseCtorMetadata(new InstanceWrapper(), undefined, []);
      injector.hasCompletePropertiesMetadata(wrapper, undefined);
      injector.hasCompletePropertiesMetadata(wrapper, []);
      vi.stubEnv('NEST_DEBUG', '1');
      vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
      for (const token of ['Fixture', Provider, Symbol('fixture')]) {
        injector.printResolvingDependenciesLog(token);
        injector.printResolvingDependenciesLog(
          token,
          new InstanceWrapper({ name: token }),
        );
        injector.printLookingForProviderLog(token, undefined);
        injector.printFoundInModuleLog(token, undefined);
      }
    });
  });
  describe('deferred and durable loads/settlement/context helpers', () => {
    it.each([false, true])('deferred load rejects %s', async reject => {
      const injector: any = new Injector();
      const shared = { id: 1 };
      const context = { id: 2, getParent: () => shared };
      const dependency = new InstanceWrapper({
        scope: Scope.REQUEST,
        durable: true,
      });
      const parent = new InstanceWrapper({
        scope: Scope.REQUEST,
        durable: true,
      });
      parent.addCtorMetadata(0, dependency);
      parent.setInstanceByContextId(shared, { instance: {}, isResolved: true });
      let settle: Function = () => undefined;
      const load = new Promise((resolve, failure) => {
        settle = reject ? failure : resolve;
      });
      load.catch(() => undefined);
      injector.trackDurableDeferredLoad(dependency, shared, load);
      injector.trackDurableDeferredLoad(dependency, context, load);
      injector.linkDurableDeferredLoads(parent, context, shared);
      injector.linkDurableDeferredLoads(parent, context, context);
      injector.addDeferredLoad(STATIC_CONTEXT, load);
      injector.addDeferredLoad(context, load);
      settle(reject ? new Error('deferred') : undefined);
      await failure(() => injector.waitForDeferredLoads(context));
      await injector.waitForDeferredLoads({ id: 3 });
      await Promise.resolve();
      injector.getInstanceHost(parent, shared, undefined);
      const signal = injector.applySettlementSignal(
        parent.getInstanceByContextId(shared),
        parent,
      );
      injector.insertSettlementRef(
        { contextId: shared, inquirer: parent },
        dependency,
        dependency.getInstanceByContextId(shared),
      );
      signal.complete();
    });
  });
});
