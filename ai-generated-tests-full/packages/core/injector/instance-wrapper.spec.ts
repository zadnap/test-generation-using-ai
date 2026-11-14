import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SCOPE_OPTIONS_METADATA } from '../../../../packages/common/constants.js';
import { Scope } from '../../../../packages/common/interfaces/scope-options.interface.js';
import { STATIC_CONTEXT } from '../../../../packages/core/injector/constants.js';
import {
  InstanceWrapper,
  INSTANCE_ID_SYMBOL,
} from '../../../../packages/core/injector/instance-wrapper.js';

const requestContext = { id: 1 } as any;

describe('InstanceWrapper', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.NEST_DEBUG;
  });

  describe('identity', () => {
    it('stores the instance and exposes its id', () => {
      const instance = { name: 'instance' };
      const wrapper = new InstanceWrapper({ instance, name: 'token' });

      expect(wrapper.instance).toBe(instance);
      expect(wrapper.id).toHaveLength(21);
    });

    it('xc1(T): reuses an id from the metadata', () => {
      const wrapper = new InstanceWrapper({
        [INSTANCE_ID_SYMBOL]: 'fixed-id',
      } as any);

      expect(wrapper.id).toBe('fixed-id');
    });

    it('xc1(F): generates an id from name and host', () => {
      class Host {}
      const wrapper = new InstanceWrapper({
        name: 'provider',
        host: { name: 'Host' } as any,
      });

      expect(wrapper.id).toHaveLength(21);
    });

    it('generates a random id without name or token', () => {
      const wrapper = new InstanceWrapper();

      expect(wrapper.id).toHaveLength(21);
    });

    it('updates the static instance through the setter', () => {
      const wrapper = new InstanceWrapper();

      wrapper.instance = 'value';

      expect(wrapper.instance).toBe('value');
    });
  });

  describe('flags', () => {
    it('xc1(T): treats missing metatypes as non-metatypes', () => {
      expect(new InstanceWrapper().isNotMetatype).toBe(true);
    });

    it('xc1(F), xc2(T): treats factory providers as non-metatypes', () => {
      const wrapper = new InstanceWrapper({
        metatype: () => undefined,
        inject: [],
      });

      expect(wrapper.isNotMetatype).toBe(true);
      expect(wrapper.isFactory).toBe(true);
    });

    it('xc2(F): treats class providers as metatypes', () => {
      const wrapper = new InstanceWrapper({ metatype: class {} });

      expect(wrapper.isNotMetatype).toBe(false);
      expect(wrapper.isFactory).toBe(false);
    });

    it('xc3(T): detects transient scope', () => {
      expect(new InstanceWrapper({ scope: Scope.TRANSIENT }).isTransient).toBe(
        true,
      );
    });

    it('xc3(F): treats other scopes as non-transient', () => {
      expect(new InstanceWrapper({ scope: Scope.DEFAULT }).isTransient).toBe(
        false,
      );
    });
  });

  describe('per-context instances', () => {
    it('xc1(T): delegates transient instances with an inquirer id', () => {
      const wrapper = new InstanceWrapper({ scope: Scope.TRANSIENT });
      const value = { instance: 'value' };
      wrapper.setInstanceByInquirerId(STATIC_CONTEXT, 'inquirer', value);

      expect(wrapper.getInstanceByContextId(STATIC_CONTEXT, 'inquirer')).toBe(
        value,
      );
    });

    it('xc1(F), xc2(T): returns the existing instance for a context', () => {
      const wrapper = new InstanceWrapper({ instance: 'value' });

      expect(wrapper.getInstanceByContextId(STATIC_CONTEXT).instance).toBe(
        'value',
      );
    });

    it('xc2(F), xc3(T): clones the static instance for another context', () => {
      const wrapper = new InstanceWrapper({
        scope: Scope.REQUEST,
        metatype: class Provider {},
      });

      const result = wrapper.getInstanceByContextId(requestContext);

      expect(result.instance).toBeInstanceOf(Object);
      expect(result.isResolved).toBe(false);
      expect(wrapper.getInstanceByContextId(requestContext)).toBe(result);
    });

    it('xc3(F): returns an empty static instance when unknown', () => {
      const wrapper = new InstanceWrapper();
      wrapper.removeInstanceByContextId(STATIC_CONTEXT);

      expect(wrapper.getInstanceByContextId(STATIC_CONTEXT)).toEqual({
        instance: null,
        isResolved: true,
        isPending: false,
      });
    });

    it('xc4(T): returns an existing transient instance', () => {
      const wrapper = new InstanceWrapper({ scope: Scope.TRANSIENT });
      const value = { instance: 'value' };
      wrapper.setInstanceByInquirerId(STATIC_CONTEXT, 'inquirer', value);

      expect(wrapper.getInstanceByInquirerId(STATIC_CONTEXT, 'inquirer')).toBe(
        value,
      );
    });

    it('xc4(F): clones a missing transient instance', () => {
      const wrapper = new InstanceWrapper({
        scope: Scope.TRANSIENT,
        metatype: class Provider {},
      });

      const result = wrapper.getInstanceByInquirerId(STATIC_CONTEXT, 'inquirer');

      expect(result.isResolved).toBe(false);
      expect(result.instance).toBeInstanceOf(Object);
    });

    it('xc5(T): delegates transient writes with an inquirer id', () => {
      const wrapper = new InstanceWrapper({ scope: Scope.TRANSIENT });
      const value = { instance: 'value' };

      wrapper.setInstanceByContextId(STATIC_CONTEXT, value, 'inquirer');

      expect(wrapper.getInstanceByInquirerId(STATIC_CONTEXT, 'inquirer')).toBe(
        value,
      );
    });

    it('xc5(F): writes regular instances directly', () => {
      const wrapper = new InstanceWrapper();
      const value = { instance: 'value' };

      wrapper.setInstanceByContextId(requestContext, value);

      expect(wrapper.getInstanceByContextId(requestContext)).toBe(value);
    });

    it('xc6(T): creates the transient collection when missing', () => {
      const wrapper = new InstanceWrapper({ scope: Scope.TRANSIENT });
      const value = { instance: 'value' };

      wrapper.setInstanceByInquirerId(requestContext, 'inquirer', value);

      expect(wrapper.getInstanceByInquirerId(requestContext, 'inquirer')).toBe(
        value,
      );
    });

    it('xc6(F): reuses an existing transient collection', () => {
      const wrapper = new InstanceWrapper({ scope: Scope.TRANSIENT });
      wrapper.setInstanceByInquirerId(requestContext, 'inquirer', {
        instance: 'first',
      });
      wrapper.setInstanceByInquirerId(requestContext, 'inquirer', {
        instance: 'second',
      });

      expect(
        wrapper.getInstanceByInquirerId(requestContext, 'inquirer').instance,
      ).toBe('second');
    });

    it('xc7(T): delegates transient removals with an inquirer id', () => {
      const wrapper = new InstanceWrapper({ scope: Scope.TRANSIENT });
      wrapper.setInstanceByInquirerId(STATIC_CONTEXT, 'inquirer', {
        instance: 'value',
      });

      wrapper.removeInstanceByContextId(STATIC_CONTEXT, 'inquirer');

      expect(
        wrapper.getInstanceByInquirerId(STATIC_CONTEXT, 'inquirer').isResolved,
      ).toBe(false);
    });

    it('xc7(F): removes regular instances directly', () => {
      const wrapper = new InstanceWrapper({ instance: 'value' });

      wrapper.removeInstanceByContextId(STATIC_CONTEXT);

      expect(wrapper.getInstanceByContextId(STATIC_CONTEXT).instance).toBeNull();
    });

    it('xc8(T): ignores removals for unknown transient collections', () => {
      const wrapper = new InstanceWrapper({ scope: Scope.TRANSIENT });

      expect(() =>
        wrapper.removeInstanceByInquirerId(STATIC_CONTEXT, 'missing'),
      ).not.toThrow();
    });

    it('xc8(F): removes instances from an existing transient collection', () => {
      const wrapper = new InstanceWrapper({ scope: Scope.TRANSIENT });
      wrapper.setInstanceByInquirerId(STATIC_CONTEXT, 'inquirer', {
        instance: 'value',
      });

      wrapper.removeInstanceByInquirerId(STATIC_CONTEXT, 'inquirer');

      expect(
        wrapper.getInstanceByInquirerId(STATIC_CONTEXT, 'inquirer').isResolved,
      ).toBe(false);
    });

    it('xc9(T): collects existing instances including transient ones', () => {
      const wrapper = new InstanceWrapper({ scope: Scope.TRANSIENT });
      const value = { instance: 'value' };
      wrapper.setInstanceByInquirerId(requestContext, 'inquirer', value);

      expect(wrapper.getExistingInstancesByContextId(requestContext)).toEqual([
        value,
      ]);
    });

    it('xc9(F): filters missing instances', () => {
      const wrapper = new InstanceWrapper();

      expect(wrapper.getExistingInstancesByContextId(requestContext)).toEqual(
        [],
      );
    });
  });

  describe('metadata', () => {
    it('xc1(T): stores constructor metadata', () => {
      const wrapper = new InstanceWrapper();
      const dependency = new InstanceWrapper();

      wrapper.addCtorMetadata(0, dependency);

      expect(wrapper.getCtorMetadata()).toEqual([dependency]);
    });

    it('xc1(F), xc2(T): ignores the same constructor dependency', () => {
      const wrapper = new InstanceWrapper();
      const dependency = new InstanceWrapper();
      wrapper.addCtorMetadata(0, dependency);

      wrapper.addCtorMetadata(0, dependency);

      expect(wrapper.getCtorMetadata()).toEqual([dependency]);
    });

    it('xc2(F): replaces a different constructor dependency', () => {
      const wrapper = new InstanceWrapper();
      const first = new InstanceWrapper();
      const second = new InstanceWrapper();
      wrapper.addCtorMetadata(0, first);

      wrapper.addCtorMetadata(0, second);

      expect(wrapper.getCtorMetadata()).toEqual([second]);
    });

    it('xc3(T): adds new property metadata', () => {
      const wrapper = new InstanceWrapper();
      const dependency = new InstanceWrapper();

      wrapper.addPropertiesMetadata('key', dependency);

      expect(wrapper.getPropertiesMetadata()).toEqual([
        { key: 'key', wrapper: dependency },
      ]);
    });

    it('xc3(F): replaces existing property metadata', () => {
      const wrapper = new InstanceWrapper();
      const first = new InstanceWrapper();
      const second = new InstanceWrapper();
      wrapper.addPropertiesMetadata('key', first);

      wrapper.addPropertiesMetadata('key', second);

      expect(wrapper.getPropertiesMetadata()).toEqual([
        { key: 'key', wrapper: second },
      ]);
    });

    it('stores enhancer metadata', () => {
      const wrapper = new InstanceWrapper();
      const enhancer = new InstanceWrapper();

      wrapper.addEnhancerMetadata(enhancer);

      expect(wrapper.getEnhancersMetadata()).toEqual([enhancer]);
    });
  });

  describe('dependency tree introspection', () => {
    it('xc1(T): returns the cached durable flag', () => {
      const wrapper = new InstanceWrapper();
      (wrapper as any).isTreeDurable = true;

      expect(wrapper.isDependencyTreeDurable()).toBe(true);
    });

    it('xc1(F), xc2(T): marks request scope durable when flagged', () => {
      const wrapper = new InstanceWrapper({
        scope: Scope.REQUEST,
        durable: true,
        name: 'provider',
      });

      expect(wrapper.isDependencyTreeDurable()).toBe(true);
    });

    it('xc2(F), xc3(T): marks request scope non-durable by default', () => {
      const wrapper = new InstanceWrapper({ scope: Scope.REQUEST });

      expect(wrapper.isDependencyTreeDurable()).toBe(false);
    });

    it('xc3(F), xc4(T): static trees are not durable', () => {
      const wrapper = new InstanceWrapper({ name: 'provider' });

      expect(wrapper.isDependencyTreeDurable()).toBe(false);
    });

    it('xc4(F), xc5(T): non-durable dependencies make the tree non-durable', () => {
      const dependency = new InstanceWrapper({ scope: Scope.REQUEST });
      const wrapper = new InstanceWrapper();
      wrapper.addCtorMetadata(0, dependency);

      expect(wrapper.isDependencyTreeDurable()).toBe(false);
    });

    it('xc5(F): durable dependencies keep the tree durable', () => {
      const dependency = new InstanceWrapper({
        scope: Scope.REQUEST,
        durable: true,
      });
      const wrapper = new InstanceWrapper();
      wrapper.addCtorMetadata(0, dependency);

      expect(wrapper.isDependencyTreeDurable()).toBe(true);
    });

    it('xc6(T): stops introspection for a visited wrapper', () => {
      const wrapper = new InstanceWrapper();

      expect(
        wrapper.introspectDepsAttribute(() => true, [wrapper.id]),
      ).toBe(false);
    });

    it('xc6(F), xc7(T): uses the dependencies callback result', () => {
      const dependency = new InstanceWrapper();
      const wrapper = new InstanceWrapper();
      wrapper.addCtorMetadata(0, dependency);
      const callback = vi.fn(() => true);

      expect(wrapper.introspectDepsAttribute(callback)).toBe(true);
    });

    it('xc7(F), xc8(T): uses the properties callback result', () => {
      const dependency = new InstanceWrapper();
      const wrapper = new InstanceWrapper();
      wrapper.addPropertiesMetadata('key', dependency);
      const callback = vi.fn(() => true);

      expect(wrapper.introspectDepsAttribute(callback)).toBe(true);
    });

    it('xc8(F), xc9(T): uses the enhancers callback result', () => {
      const enhancer = new InstanceWrapper();
      const wrapper = new InstanceWrapper();
      wrapper.addEnhancerMetadata(enhancer);
      const callback = vi.fn(() => true);

      expect(wrapper.introspectDepsAttribute(callback)).toBe(true);
    });

    it('xc9(F): returns false when no callback matches', () => {
      const wrapper = new InstanceWrapper();

      expect(wrapper.introspectDepsAttribute(() => false)).toBe(false);
    });

    it('xc10(T): returns the cached static flag', () => {
      const wrapper = new InstanceWrapper();
      (wrapper as any).isTreeStatic = true;

      expect(wrapper.isDependencyTreeStatic()).toBe(true);
    });

    it('xc10(F), xc11(T): request-scoped wrappers are not static', () => {
      const wrapper = new InstanceWrapper({ scope: Scope.REQUEST });

      expect(wrapper.isDependencyTreeStatic()).toBe(false);
    });

    it('xc11(F), xc12(T): wrappers without dependencies are static', () => {
      const wrapper = new InstanceWrapper();

      expect(wrapper.isDependencyTreeStatic()).toBe(true);
    });

    it('xc12(F): non-static dependencies make the tree non-static', () => {
      const dependency = new InstanceWrapper({ scope: Scope.REQUEST });
      const wrapper = new InstanceWrapper();
      wrapper.addCtorMetadata(0, dependency);

      expect(wrapper.isDependencyTreeStatic()).toBe(false);
    });

    it('logs debug information for request scoped wrappers', () => {
      process.env.NEST_DEBUG = '1';
      const log = vi.spyOn(Logger.prototype, 'log');
      const wrapper = new InstanceWrapper({
        scope: Scope.REQUEST,
        name: 'provider',
      });

      wrapper.isDependencyTreeStatic();

      expect(log).toHaveBeenCalled();
    });

    it('does not log for the REQUEST token', () => {
      process.env.NEST_DEBUG = '1';
      const log = vi.spyOn(Logger.prototype, 'log');
      const wrapper = new InstanceWrapper({ scope: Scope.REQUEST, name: 'REQUEST' });

      wrapper.isDependencyTreeStatic();

      expect(log).not.toHaveBeenCalled();
    });

    it('logs durable introspection in debug mode', () => {
      process.env.NEST_DEBUG = '1';
      const log = vi.spyOn(Logger.prototype, 'log');
      const wrapper = new InstanceWrapper({
        scope: Scope.REQUEST,
        durable: true,
        name: 'provider',
      });

      wrapper.isDependencyTreeDurable();

      expect(log).toHaveBeenCalled();
    });
  });

  describe('cloning', () => {
    it('xc1(T): returns the static instance for static trees', () => {
      const wrapper = new InstanceWrapper({ instance: 'value' });

      expect(wrapper.cloneStaticInstance(requestContext).instance).toBe(
        'value',
      );
    });

    it('xc1(F), xc2(T): clones newable non-static instances', () => {
      const wrapper = new InstanceWrapper({
        scope: Scope.REQUEST,
        metatype: class Provider {},
      });

      const clone = wrapper.cloneStaticInstance(requestContext);

      expect(clone.instance).toBeInstanceOf(Object);
      expect(clone.isResolved).toBe(false);
    });

    it('xc2(F): leaves factory clones without an instance', () => {
      const wrapper = new InstanceWrapper({
        scope: Scope.REQUEST,
        metatype: () => undefined,
        inject: [],
      });

      expect(wrapper.cloneStaticInstance(requestContext).instance).toBe(
        undefined,
      );
    });

    it('xc3(T): clones newable transient instances', () => {
      const wrapper = new InstanceWrapper({
        scope: Scope.TRANSIENT,
        metatype: class Provider {},
      });

      const clone = wrapper.cloneTransientInstance(requestContext, 'inquirer');

      expect(clone.instance).toBeInstanceOf(Object);
      expect(
        wrapper.getInstanceByInquirerId(requestContext, 'inquirer'),
      ).toBe(clone);
    });

    it('xc3(F): leaves factory transient clones without an instance', () => {
      const wrapper = new InstanceWrapper({
        scope: Scope.TRANSIENT,
        metatype: () => undefined,
        inject: [],
      });

      expect(
        wrapper.cloneTransientInstance(requestContext, 'inquirer').instance,
      ).toBe(undefined);
    });

    it('xc4(T): returns no prototype for non-newable wrappers', () => {
      const wrapper = new InstanceWrapper({ inject: [] });

      expect(wrapper.createPrototype(requestContext)).toBeUndefined();
    });

    it('xc4(F), xc5(T): returns no prototype when the host is resolved', () => {
      const wrapper = new InstanceWrapper({
        metatype: class Provider {},
        isResolved: true,
      });

      expect(wrapper.createPrototype(STATIC_CONTEXT)).toBeUndefined();
    });

    it('xc5(F): creates a prototype for unresolved hosts', () => {
      const wrapper = new InstanceWrapper({
        metatype: class Provider {},
        isResolved: false,
      });

      expect(wrapper.createPrototype(STATIC_CONTEXT)).toBeInstanceOf(
        Object,
      );
    });
  });

  describe('scope helpers', () => {
    it('xc1(T): request-scoped in a request context', () => {
      const wrapper = new InstanceWrapper({ scope: Scope.REQUEST });

      expect(wrapper.isInRequestScope(requestContext)).toBe(true);
    });

    it('xc1(F), xc2(T): not request-scoped for static trees', () => {
      const wrapper = new InstanceWrapper();

      expect(wrapper.isInRequestScope(requestContext)).toBe(false);
    });

    it('xc2(F), xc3(T): not request-scoped in the static context', () => {
      const wrapper = new InstanceWrapper({ scope: Scope.REQUEST });

      expect(wrapper.isInRequestScope(STATIC_CONTEXT)).toBe(false);
    });

    it('xc3(F), xc4(T): transient wrappers need an inquirer', () => {
      const wrapper = new InstanceWrapper({
        scope: Scope.TRANSIENT,
        durable: true,
      });
      (wrapper as any).isTreeStatic = false;

      expect(wrapper.isInRequestScope(requestContext)).toBe(false);
      expect(
        wrapper.isInRequestScope(requestContext, new InstanceWrapper()),
      ).toBe(true);
    });

    it('xc5(T): detects lazy transient instances', () => {
      const wrapper = new InstanceWrapper({ scope: Scope.TRANSIENT });
      const inquirer = new InstanceWrapper({ scope: Scope.REQUEST });

      expect(wrapper.isLazyTransient(requestContext, inquirer)).toBe(true);
    });

    it('xc5(F), xc6(T): not lazy without an inquirer', () => {
      const wrapper = new InstanceWrapper({ scope: Scope.TRANSIENT });

      expect(wrapper.isLazyTransient(requestContext, undefined)).toBe(false);
    });

    it('xc6(F), xc7(T): not lazy in the static context', () => {
      const wrapper = new InstanceWrapper({ scope: Scope.TRANSIENT });
      const inquirer = new InstanceWrapper({ scope: Scope.REQUEST });

      expect(wrapper.isLazyTransient(STATIC_CONTEXT, inquirer)).toBe(false);
    });

    it('xc7(F), xc8(T): not lazy for non-transient wrappers', () => {
      const wrapper = new InstanceWrapper();
      const inquirer = new InstanceWrapper({ scope: Scope.REQUEST });

      expect(wrapper.isLazyTransient(requestContext, inquirer)).toBe(false);
    });

    it('xc8(F): not lazy for static inquirers', () => {
      const wrapper = new InstanceWrapper({ scope: Scope.TRANSIENT });

      expect(
        wrapper.isLazyTransient(requestContext, new InstanceWrapper()),
      ).toBe(false);
    });

    it('xc9(T): self-requested wrappers are explicit', () => {
      const wrapper = new InstanceWrapper();

      expect(wrapper.isExplicitlyRequested(requestContext, wrapper)).toBe(true);
    });

    it('xc9(F), xc10(T): transient inquirers are explicit', () => {
      const wrapper = new InstanceWrapper();
      const inquirer = new InstanceWrapper({ scope: Scope.TRANSIENT });

      expect(wrapper.isExplicitlyRequested(requestContext, inquirer)).toBe(true);
    });

    it('xc10(F): static wrappers are not explicit', () => {
      const wrapper = new InstanceWrapper();

      expect(wrapper.isExplicitlyRequested(requestContext)).toBe(false);
    });

    it('xc11(T): static non-transient wrappers are static', () => {
      const wrapper = new InstanceWrapper();

      expect(wrapper.isStatic(STATIC_CONTEXT, undefined)).toBe(true);
    });

    it('xc11(F), xc12(T): non-static trees are never static', () => {
      const wrapper = new InstanceWrapper({ scope: Scope.REQUEST });

      expect(wrapper.isStatic(STATIC_CONTEXT, undefined)).toBe(false);
    });

    it('xc12(F), xc13(T): non-static contexts are never static', () => {
      const wrapper = new InstanceWrapper();

      expect(wrapper.isStatic(requestContext, undefined)).toBe(false);
    });

    it('xc13(F), xc14(T): transient inquired by non-transient is static', () => {
      const wrapper = new InstanceWrapper({ scope: Scope.TRANSIENT });
      const inquirer = new InstanceWrapper();

      expect(wrapper.isStatic(STATIC_CONTEXT, inquirer)).toBe(true);
    });

    it('xc14(F), xc15(T): nested transient with a non-transient root is static', () => {
      const wrapper = new InstanceWrapper({ scope: Scope.TRANSIENT });
      const inquirer = new InstanceWrapper({ scope: Scope.TRANSIENT });
      const root = new InstanceWrapper();

      expect(wrapper.isStatic(STATIC_CONTEXT, inquirer, root)).toBe(true);
    });

    it('xc15(F), xc16(T): nested transient during instantiation is static', () => {
      const wrapper = new InstanceWrapper({ scope: Scope.TRANSIENT });
      const inquirer = new InstanceWrapper({ scope: Scope.TRANSIENT });

      expect(wrapper.isStatic(STATIC_CONTEXT, inquirer)).toBe(true);
    });

    it('xc16(F): transient inquired by request scoped is not static', () => {
      const wrapper = new InstanceWrapper({ scope: Scope.TRANSIENT });
      const inquirer = new InstanceWrapper({ scope: Scope.REQUEST });

      expect(wrapper.isStatic(STATIC_CONTEXT, inquirer)).toBe(false);
    });
  });

  describe('dependency graph', () => {
    it('xc1(T): returns direct dependents', () => {
      const child = new InstanceWrapper();
      const parent = new InstanceWrapper();
      parent.addCtorMetadata(0, child);

      expect(child.getDependents()).toEqual(new Set([parent]));
    });

    it('xc1(F): returns no dependents for a leaf', () => {
      expect(new InstanceWrapper().getDependents()).toEqual(new Set());
    });

    it('xc2(T): returns transitive dependents', () => {
      const child = new InstanceWrapper();
      const parent = new InstanceWrapper();
      const grandParent = new InstanceWrapper();
      parent.addCtorMetadata(0, child);
      grandParent.addPropertiesMetadata('key', parent);

      expect(child.getDependents()).toEqual(new Set([parent, grandParent]));
    });

    it('xc2(F): detaches dependencies from their parents', () => {
      const child = new InstanceWrapper();
      const parent = new InstanceWrapper();
      parent.addCtorMetadata(0, child);

      parent.detachFromDependencies();

      expect(child.getDependents()).toEqual(new Set());
    });
  });

  describe('root inquirer', () => {
    it('xc1(T): does not attach a root inquirer to non-transient wrappers', () => {
      const wrapper = new InstanceWrapper();

      wrapper.attachRootInquirer(new InstanceWrapper());

      expect(wrapper.getRootInquirer()).toBeUndefined();
    });

    it('xc1(F), xc2(T): attaches the inquirer itself', () => {
      const wrapper = new InstanceWrapper({ scope: Scope.TRANSIENT });
      const inquirer = new InstanceWrapper();

      wrapper.attachRootInquirer(inquirer);

      expect(wrapper.getRootInquirer()).toBe(inquirer);
    });

    it('xc2(F): reuses the inquirer root', () => {
      const wrapper = new InstanceWrapper({ scope: Scope.TRANSIENT });
      const root = new InstanceWrapper();
      const inquirer = new InstanceWrapper({ scope: Scope.TRANSIENT });
      inquirer.attachRootInquirer(root);

      wrapper.attachRootInquirer(inquirer);

      expect(wrapper.getRootInquirer()).toBe(root);
    });
  });

  describe('static transient instances', () => {
    it('xc1(T): returns an empty list without a transient map', () => {
      expect(new InstanceWrapper().getStaticTransientInstances()).toEqual([]);
    });

    it('xc1(F), xc2(T): returns constructed static transient instances', () => {
      const wrapper = new InstanceWrapper({ scope: Scope.TRANSIENT });
      wrapper.setInstanceByInquirerId(STATIC_CONTEXT, 'inquirer', {
        instance: 'value',
        isConstructorCalled: true,
      });

      expect(wrapper.getStaticTransientInstances()).toEqual([
        {
          instance: 'value',
          isConstructorCalled: true,
        },
      ]);
    });

    it('xc2(F): filters instances whose constructor was not called', () => {
      const wrapper = new InstanceWrapper({ scope: Scope.TRANSIENT });
      wrapper.setInstanceByInquirerId(STATIC_CONTEXT, 'inquirer', {
        instance: 'value',
      });

      expect(wrapper.getStaticTransientInstances()).toEqual([]);
    });
  });

  describe('mergeWith', () => {
    it('xc1(T): merges value providers', () => {
      const wrapper = new InstanceWrapper();
      const value = { name: 'value' };

      wrapper.mergeWith({ provide: 'token', useValue: value });

      expect(wrapper.metatype).toBeNull();
      expect(wrapper.inject).toBeNull();
      expect(wrapper.scope).toBe(Scope.DEFAULT);
      expect(wrapper.instance).toBe(value);
      expect(wrapper.isAlias).toBe(false);
    });

    it('xc1(F), xc2(T): merges class providers', () => {
      class Provider {}
      const wrapper = new InstanceWrapper();

      wrapper.mergeWith({ provide: 'token', useClass: Provider });

      expect(wrapper.metatype).toBe(Provider);
      expect(wrapper.inject).toBeNull();
      expect(wrapper.scope).toBe(Scope.DEFAULT);
    });

    it('xc2(F), xc3(T): merges transient class providers', () => {
      class Provider {}
      Reflect.defineMetadata(
        SCOPE_OPTIONS_METADATA,
        { scope: Scope.TRANSIENT },
        Provider,
      );
      const wrapper = new InstanceWrapper();

      wrapper.mergeWith({ provide: 'token', useClass: Provider });

      expect(wrapper.scope).toBe(Scope.TRANSIENT);
      expect((wrapper as any).transientMap).toBeInstanceOf(Map);
    });

    it('xc3(F), xc4(T): merges factory providers', () => {
      const factory = () => 'value';
      const wrapper = new InstanceWrapper();

      wrapper.mergeWith({ provide: 'token', useFactory: factory });

      expect(wrapper.metatype).toBe(factory);
      expect(wrapper.inject).toEqual([]);
    });

    it('xc4(F): keeps the wrapper unchanged for unknown providers', () => {
      const wrapper = new InstanceWrapper({ metatype: class Provider {} });

      wrapper.mergeWith({ provide: 'token' } as any);

      expect(wrapper.metatype).toBeInstanceOf(Function);
      expect(wrapper.isAlias).toBe(false);
    });
  });
});
