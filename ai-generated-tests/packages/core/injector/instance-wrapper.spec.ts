/**
 * CFT checklist extracted from packages/core/injector/instance-wrapper.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * InstanceWrapper.hierarchyLevel @L116 - D=0, P=1.
 * InstanceWrapper.hierarchyLevel @L120 - D=0, P=1.
 * InstanceWrapper.constructor @L130 - D=1, P=2.
 *   1=this.isNewable()
 * InstanceWrapper.id @L141 - D=0, P=1.
 * InstanceWrapper.instance @L145 - D=0, P=1.
 * InstanceWrapper.instance @L149 - D=0, P=1.
 * InstanceWrapper.isNotMetatype @L154 - D=2, P=3.
 *   1c1=!this.metatype | 1c2=this.isFactory
 * InstanceWrapper.isFactory @L158 - D=2, P=3.
 *   1c1=!!this.metatype | 1c2=!isNil(this.inject)
 * InstanceWrapper.isTransient @L162 - D=0, P=1.
 * InstanceWrapper.getInstanceByContextId @L166 - D=4, P=5.
 *   1c1=this.scope === Scope.TRANSIENT | 1c2=inquirerId
 *   2=instancePerContext
 *   3=contextId !== STATIC_CONTEXT
 * InstanceWrapper.getInstanceByInquirerId @L185 - D=2, P=3.
 *   1=!collectionPerContext
 *   2=instancePerContext
 * InstanceWrapper.setInstanceByContextId @L200 - D=2, P=3.
 *   1c1=this.scope === Scope.TRANSIENT | 1c2=inquirerId
 * InstanceWrapper.setInstanceByInquirerId @L211 - D=1, P=2.
 *   1=!collection
 * InstanceWrapper.removeInstanceByContextId @L224 - D=2, P=3.
 *   1c1=this.scope === Scope.TRANSIENT | 1c2=inquirerId
 * InstanceWrapper.removeInstanceByInquirerId @L231 - D=1, P=2.
 *   1=!collection
 * InstanceWrapper.getExistingInstancesByContextId @L244 - D=0, P=1.
 * InstanceWrapper.callback @L249 - D=0, P=1.
 * InstanceWrapper.callback @L250 - D=0, P=1.
 * InstanceWrapper.addCtorMetadata @L253 - D=2, P=3.
 *   1=!this[INSTANCE_METADATA_SYMBOL].dependencies
 *   2=this[INSTANCE_METADATA_SYMBOL].dependencies[index] === wrapper
 * InstanceWrapper.getCtorMetadata @L265 - D=0, P=1.
 * InstanceWrapper.addPropertiesMetadata @L269 - D=2, P=3.
 *   1=!this[INSTANCE_METADATA_SYMBOL].properties
 *   2=index === -1
 * InstanceWrapper.callback @L276 - D=0, P=1.
 * InstanceWrapper.getPropertiesMetadata @L286 - D=0, P=1.
 * InstanceWrapper.addEnhancerMetadata @L290 - D=1, P=2.
 *   1=!this[INSTANCE_METADATA_SYMBOL].enhancers
 * InstanceWrapper.getEnhancersMetadata @L299 - D=0, P=1.
 * InstanceWrapper.isDependencyTreeDurable @L303 - D=6, P=7.
 *   1=!isUndefined(this.isTreeDurable)
 *   2=this.scope === Scope.REQUEST
 *   3=this.durable === undefined
 *   4=this.isTreeDurable
 *   5=isStatic
 *   6=this.isTreeDurable
 * InstanceWrapper.callback @L321 - D=0, P=1.
 * InstanceWrapper.callback @L323 - D=2, P=3.
 *   1c1=!item.isDependencyTreeStatic() | 1c2=!item.isDependencyTreeDurable(registry)
 * InstanceWrapper.introspectDepsAttribute @L338 - D=8, P=9.
 *   1=lookupRegistry.includes(this[INSTANCE_ID_SYMBOL])
 *   2=dependencies
 *   3c1=introspectionResult | 3c2=!(properties || enhancers)
 *   4=properties
 *   5c1=introspectionResult | 5c2=!enhancers
 *   6=enhancers
 * InstanceWrapper.callback @L362 - D=0, P=1.
 * InstanceWrapper.isDependencyTreeStatic @L372 - D=3, P=4.
 *   1=!isUndefined(this.isTreeStatic)
 *   2=this.scope === Scope.REQUEST
 *   3=!this.isTreeStatic
 * InstanceWrapper.callback @L383 - D=0, P=1.
 * InstanceWrapper.callback @L385 - D=0, P=1.
 * InstanceWrapper.cloneStaticInstance @L396 - D=2, P=3.
 *   1=this.isDependencyTreeStatic()
 *   2=this.isNewable()
 * InstanceWrapper.cloneTransientInstance @L414 - D=1, P=2.
 *   1=this.isNewable()
 * InstanceWrapper.createPrototype @L432 - D=2, P=3.
 *   1c1=!this.isNewable() | 1c2=host.isResolved
 * InstanceWrapper.isInRequestScope @L440 - D=5, P=6.
 *   1c1=!isDependencyTreeStatic | 1c2=contextId !== STATIC_CONTEXT | 1c3=!this.isTransient | 1c4=this.isTransient | 1c5=!!inquirer
 * InstanceWrapper.isLazyTransient @L453 - D=6, P=7.
 *   1c1=inquirer | 1c2=!inquirer.isDependencyTreeStatic()
 *   2c1=this.isDependencyTreeStatic() | 2c2=contextId !== STATIC_CONTEXT | 2c3=this.isTransient | 2c4=isInquirerRequestScoped
 * InstanceWrapper.isExplicitlyRequested @L469 - D=4, P=5.
 *   1c1=this.isDependencyTreeStatic() | 1c2=contextId !== STATIC_CONTEXT | 1c3=isSelfRequested | 1c4=!!(inquirer && inquirer.scope === Scope.TRANSIENT)
 * InstanceWrapper.isStatic @L481 - D=16, P=17.
 *   1c1=!this.isDependencyTreeStatic() | 1c2=contextId !== STATIC_CONTEXT
 *   2=!this.isTransient
 *   3c1=inquirer | 3c2=!inquirer.isDependencyTreeStatic()
 *   4c1=this.isTransient | 4c2=!isInquirerRequestScoped
 *   5c1=isStaticTransient | 5c2=inquirer | 5c3=!inquirer.isTransient
 *   6c1=isStaticTransient | 6c2=rootInquirer | 6c3=!rootInquirer.isTransient
 *   7c1=isStaticTransient | 7c2=inquirer?.isTransient | 7c3=!rootInquirer
 * InstanceWrapper.detachFromDependencies @L517 - D=0, P=1.
 * InstanceWrapper.callback @L518 - D=0, P=1.
 * InstanceWrapper.getDependents @L528 - D=1, P=2.
 *   1=wrappers.length > 0
 * InstanceWrapper.callback @L532 - D=1, P=2.
 *   1=!dependents.has(parent)
 * InstanceWrapper.attachRootInquirer @L547 - D=1, P=2.
 *   1=!this.isTransient
 * InstanceWrapper.getRootInquirer @L560 - D=0, P=1.
 * InstanceWrapper.getStaticTransientInstances @L564 - D=1, P=2.
 *   1=!this.transientMap
 * InstanceWrapper.callback @L570 - D=0, P=1.
 * InstanceWrapper.callback @L571 - D=2, P=3.
 *   1c1=item | 1c2=item.isConstructorCalled
 * InstanceWrapper.mergeWith @L579 - D=7, P=8.
 *   1=Object.hasOwn(provider, 'useValue')
 *   2=isClassProvider(provider)
 *   3c1=this.scope === Scope.TRANSIENT | 3c2=!this.transientMap
 *   4=isFactoryProvider(provider)
 *   5c1=provider.inject | 5c2=[]
 * InstanceWrapper.resetStaticInstance @L610 - D=0, P=1.
 * InstanceWrapper.isNewable @L618 - D=3, P=4.
 *   1c1=isNil(this.inject) | 1c2=this.metatype | 1c3=this.metatype.prototype
 * InstanceWrapper.registerDependencyTreeParent @L622 - D=1, P=2.
 *   1=wrapper instanceof InstanceWrapper
 * InstanceWrapper.getDependencyWrappers @L630 - D=0, P=1.
 * InstanceWrapper.callback @L635 - D=0, P=1.
 * InstanceWrapper.callback @L636 - D=0, P=1.
 * InstanceWrapper.removeTransientInstancesOf @L639 - D=4, P=5.
 *   1=!this.transientMap
 *   2=next iteration of this.transientMap.keys()
 *   3c1=inquirerId === inquirer.id | 3c2=inquirerId.startsWith(`${inquirer.id}:`)
 * InstanceWrapper.callback @L652 - D=0, P=1.
 * InstanceWrapper.resetDependencyTreeState @L657 - D=2, P=3.
 *   1=lookupRegistry.has(this[INSTANCE_ID_SYMBOL])
 *   2=!this.isTreeIntrospected
 * InstanceWrapper.callback @L670 - D=0, P=1.
 * InstanceWrapper.invalidateDependencyTreeParents @L679 - D=0, P=1.
 * InstanceWrapper.callback @L682 - D=1, P=2.
 *   1=parent[attribute]
 * InstanceWrapper.initialize @L690 - D=2, P=3.
 *   1c1=this.scope === Scope.TRANSIENT | 1c2=this.transientMap = new Map()
 * InstanceWrapper.printIntrospectedAsRequestScoped @L703 - D=3, P=4.
 *   1c1=!isDebugMode() | 1c2=this.name === 'REQUEST'
 *   2=isString(this.name)
 * InstanceWrapper.printIntrospectedAsDurable @L716 - D=2, P=3.
 *   1=!isDebugMode()
 *   2=isString(this.name)
 * InstanceWrapper.generateUuid @L729 - D=1, P=2.
 *   1=key
 */
import { afterEach, describe, it, vi } from 'vitest';
import { Injectable, Scope, Logger } from '@nestjs/common';
import { InstanceWrapper } from '../../../../packages/core/injector/instance-wrapper.js';
import { STATIC_CONTEXT } from '../../../../packages/core/injector/constants.js';
const context = () => ({ id: Math.random() });
const wrapper = (metadata: any = {}) =>
  new InstanceWrapper<any>({
    name: 'Fixture',
    metatype: class Fixture {},
    instance: null,
    ...metadata,
  });
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
describe('InstanceWrapper', () => {
  describe('constructor/initialize/accessors/createPrototype', () => {
    it.each([
      {},
      { metatype: null },
      { metatype: () => undefined, inject: [] },
      { isResolved: true },
      { scope: Scope.TRANSIENT },
      { scope: Scope.REQUEST },
    ])('metadata %j', metadata => {
      const value = wrapper(metadata);
      value.id;
      value.instance;
      value.instance = {};
      value.instance;
      value.isFactory;
      value.isNotMetatype;
      value.isTransient;
      value.hierarchyLevel = 2;
      value.hierarchyLevel;
      value.createPrototype(STATIC_CONTEXT);
      value.createPrototype(context());
      value.getStaticTransientInstances();
      value.getRootInquirer();
    });
    it('default constructor and no name/token UUID', () => {
      new InstanceWrapper();
    });
  });
  describe('get/set/remove instances by context and inquirer/clone helpers', () => {
    it.each([Scope.DEFAULT, Scope.REQUEST, Scope.TRANSIENT])(
      'scope %i',
      scope => {
        const value = wrapper({ scope });
        const id = context();
        value.getInstanceByContextId(id);
        value.getInstanceByContextId(id, 'caller');
        value.setInstanceByContextId(id, { instance: {} }, 'caller');
        value.getInstanceByContextId(id, 'caller');
        value.getExistingInstancesByContextId(id);
        value.getExistingInstancesByContextId(context());
        value.removeInstanceByContextId(id, 'caller');
        value.removeInstanceByContextId(id);
        if (scope === Scope.TRANSIENT) {
          value.setInstanceByInquirerId(id, 'new', { instance: {} });
          value.setInstanceByInquirerId(id, 'new', { instance: {} });
          value.removeInstanceByInquirerId(id, 'missing');
          value.removeInstanceByInquirerId(id, 'new');
          value.setInstanceByInquirerId(STATIC_CONTEXT, 'static', {
            instance: {},
            isConstructorCalled: true,
          });
          value.setInstanceByInquirerId(STATIC_CONTEXT, 'unconstructed', {
            instance: {},
          });
          value.getStaticTransientInstances();
        }
      },
    );
    it('request-scoped factory clones a non-newable source', () => {
      wrapper({
        scope: Scope.REQUEST,
        inject: [],
        metatype: () => undefined,
      }).cloneStaticInstance(context());
      wrapper({
        scope: Scope.TRANSIENT,
        inject: [],
        metatype: () => undefined,
      }).cloneTransientInstance(context(), 'caller');
    });
  });
  describe('dependency metadata/static/durable introspection/parents/reset/detach', () => {
    it.each([undefined, false, true])(
      'request dependency durable %s',
      durable => {
        const root: any = wrapper();
        const request = wrapper({ scope: Scope.REQUEST, durable });
        const transient = wrapper({ scope: Scope.TRANSIENT });
        root.isDependencyTreeStatic();
        root.isDependencyTreeDurable();
        root.addCtorMetadata(0, request);
        root.addCtorMetadata(0, request);
        root.addPropertiesMetadata('field', transient);
        root.addPropertiesMetadata('field', request);
        root.addPropertiesMetadata(Symbol('field'), transient);
        root.addEnhancerMetadata(request);
        root.addEnhancerMetadata(transient);
        root.getCtorMetadata();
        root.getPropertiesMetadata();
        root.getEnhancersMetadata();
        root.isDependencyTreeStatic();
        root.isDependencyTreeStatic();
        root.isDependencyTreeDurable();
        root.isDependencyTreeDurable();
        root.introspectDepsAttribute(() => false);
        root.introspectDepsAttribute(() => true);
        root.introspectDepsAttribute(() => false, [root.id]);
        transient.getDependents();
        request.getDependents();
        transient.setInstanceByInquirerId(STATIC_CONTEXT, root.id, {
          instance: {},
        });
        transient.setInstanceByInquirerId(STATIC_CONTEXT, root.id + ':nested', {
          instance: {},
        });
        transient.setInstanceByInquirerId(STATIC_CONTEXT, 'unrelated', {
          instance: {},
        });
        root.detachFromDependencies();
        request.mergeWith({ provide: 'fixture', useValue: {} });
        root.resetDependencyTreeState(new Set([root.id]));
      },
    );
    it('property/enhancer-only dependencies and cyclic parent invalidation', () => {
      const first: any = wrapper();
      const second = wrapper();
      first.addPropertiesMetadata('field', second);
      second.addEnhancerMetadata(first);
      first.isDependencyTreeStatic();
      first.isDependencyTreeDurable();
      second.addCtorMetadata(0, wrapper({ scope: Scope.REQUEST }));
      first.isDependencyTreeStatic();
      first.isDependencyTreeDurable();
      wrapper().introspectDepsAttribute(() => false);
      const enhancer = wrapper();
      enhancer.addEnhancerMetadata(wrapper());
      enhancer.introspectDepsAttribute(() => false);
    });
  });
  describe('isInRequestScope/isLazyTransient/isExplicitlyRequested/isStatic/attachRootInquirer', () => {
    it.each([
      [Scope.DEFAULT, 'static', 'none', 'none'],
      [Scope.DEFAULT, 'dynamic', 'self', 'none'],
      [Scope.REQUEST, 'static', 'none', 'none'],
      [Scope.REQUEST, 'dynamic', 'none', 'none'],
      [Scope.TRANSIENT, 'static', 'none', 'none'],
      [Scope.TRANSIENT, 'static', 'default', 'none'],
      [Scope.TRANSIENT, 'static', 'transient', 'none'],
      [Scope.TRANSIENT, 'static', 'transient', 'default'],
      [Scope.TRANSIENT, 'static', 'request', 'transient'],
      [Scope.TRANSIENT, 'static', 'none', 'default'],
      [Scope.TRANSIENT, 'dynamic', 'request', 'none'],
      [Scope.DEFAULT, 'dynamic', 'transient', 'none'],
    ])(
      'scope %s/context %s/inquirer %s/root %s',
      (scope, kind, inquirerKind, rootKind) => {
        const value = wrapper({ scope });
        const kinds: any = {
          none: undefined,
          self: value,
          default: wrapper(),
          request: wrapper({ scope: Scope.REQUEST }),
          transient: wrapper({ scope: Scope.TRANSIENT }),
        };
        const id = kind === 'static' ? STATIC_CONTEXT : context();
        const inquirer = kinds[inquirerKind];
        const root = kinds[rootKind];
        value.isInRequestScope(id, inquirer);
        value.isLazyTransient(id, inquirer);
        value.isExplicitlyRequested(id, inquirer);
        value.isStatic(id, inquirer, root);
        if (inquirer) {
          value.attachRootInquirer(inquirer);
          value.getRootInquirer();
        }
      },
    );
    it('non-static transient tree with and without inquirer', () => {
      const value = wrapper({ scope: Scope.TRANSIENT });
      value.addCtorMetadata(0, wrapper({ scope: Scope.REQUEST }));
      value.isInRequestScope(context());
      value.isInRequestScope(context(), wrapper());
    });
  });
  describe('mergeWith/resetStaticInstance', () => {
    it.each([
      { provide: 'fixture', useValue: undefined },
      { provide: 'fixture', useClass: class Replacement {} },
      { provide: 'fixture', useFactory: () => undefined },
      { provide: 'fixture', useFactory: () => undefined, inject: ['dep'] },
      { provide: 'fixture' },
    ])('provider %j', provider => {
      wrapper().mergeWith(provider);
    });
    it('transient class replacement', () => {
      @Injectable({ scope: Scope.TRANSIENT })
      class Transient {}
      const value = wrapper();
      value.mergeWith({ provide: 'fixture', useClass: Transient });
      value.mergeWith({ provide: 'fixture', useClass: Transient });
    });
  });
  describe('debug introspection logging', () => {
    it.each(['Fixture', 'REQUEST', Symbol('fixture')])('name %s', name => {
      vi.stubEnv('NEST_DEBUG', '1');
      vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
      const value = wrapper({ name, scope: Scope.REQUEST, durable: true });
      value.isDependencyTreeStatic();
      value.isDependencyTreeDurable();
    });
  });
});
