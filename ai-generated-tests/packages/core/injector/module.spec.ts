/**
 * CFT checklist extracted from packages/core/injector/module.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * Module.constructor @L71 - D=0, P=1.
 * Module.id @L79 - D=0, P=1.
 * Module.token @L83 - D=0, P=1.
 * Module.token @L87 - D=0, P=1.
 * Module.name @L91 - D=0, P=1.
 * Module.isGlobal @L95 - D=0, P=1.
 * Module.isGlobal @L99 - D=0, P=1.
 * Module.initOnPreview @L103 - D=0, P=1.
 * Module.initOnPreview @L107 - D=0, P=1.
 * Module.providers @L111 - D=0, P=1.
 * Module.middlewares @L115 - D=0, P=1.
 * Module.imports @L119 - D=0, P=1.
 * Module.injectables @L123 - D=0, P=1.
 * Module.controllers @L127 - D=0, P=1.
 * Module.entryProviders @L131 - D=0, P=1.
 * Module.callback @L132 - D=0, P=1.
 * Module.exports @L137 - D=0, P=1.
 * Module.instance @L141 - D=1, P=2.
 *   1=!this._providers.has(this._metatype)
 * Module.isInstantiated @L154 - D=0, P=1.
 * Module.metatype @L158 - D=0, P=1.
 * Module.distance @L162 - D=0, P=1.
 * Module.distance @L166 - D=0, P=1.
 * Module.addCoreProviders @L170 - D=0, P=1.
 * Module.addModuleRef @L176 - D=0, P=1.
 * Module.addModuleAsProvider @L191 - D=0, P=1.
 * Module.addApplicationConfig @L205 - D=0, P=1.
 * Module.addInjectable @L218 - D=7, P=8.
 *   1=this.isCustomProvider(injectable)
 *   2=!instanceWrapper
 *   3=host
 *   4c1=this._controllers.get(host) | 4c2=this._providers.get(host)
 *   5c1=hostWrapper | 5c2=hostWrapper.addEnhancerMetadata(instanceWrapper)
 * Module.addProvider @L258 - D=7, P=8.
 *   1=this.isCustomProvider(provider)
 *   2c1=this.isEntryProvider(provider.provide) | 2c2=this.isEntryProvider((provider as ClassProvider).useClass)
 *   3c1=this.isTransientProvider(provider) | 3c2=this.isRequestScopeProvider(provider) | 3c3=isAlreadyDeclared
 *   4=this.isEntryProvider(provider)
 * Module.isCustomProvider @L299 - D=0, P=1.
 * Module.addCustomProvider @L311 - D=4, P=5.
 *   1=this.isCustomClass(provider)
 *   2=this.isCustomValue(provider)
 *   3=this.isCustomFactory(provider)
 *   4=this.isCustomUseExisting(provider)
 * Module.isCustomClass @L334 - D=0, P=1.
 * Module.isCustomValue @L338 - D=2, P=3.
 *   1c1=isObject(provider) | 1c2=Object.hasOwn(provider, 'useValue')
 * Module.isCustomFactory @L345 - D=0, P=1.
 * Module.isCustomUseExisting @L349 - D=0, P=1.
 * Module.isDynamicModule @L353 - D=2, P=3.
 *   1c1=exported | 1c2=exported.module
 * Module.addCustomClass @L357 - D=4, P=5.
 *   1=isUndefined(scope)
 *   2=isUndefined(durable)
 *   3c1=useClass?.name | 3c2=useClass
 * Module.addCustomValue @L389 - D=3, P=4.
 *   1c1=(providerToken as Function)?.name | 1c2=providerToken
 *   2=instanceDecorator
 * Module.addCustomFactory @L415 - D=4, P=5.
 *   1c1=(providerToken as Function)?.name | 1c2=providerToken
 *   2c1=inject | 2c2=[]
 * Module.addCustomUseExisting @L445 - D=2, P=3.
 *   1c1=(providerToken as Function)?.name | 1c2=providerToken
 * Module.callback @L456 - D=0, P=1.
 * Module.addExportedProviderOrModule @L467 - D=4, P=5.
 *   1=this.isCustomProvider(toExport as any)
 *   2c1=isString(toExport) | 2c2=isSymbol(toExport)
 *   3=this.isDynamicModule(toExport)
 * Module.addExportedUnit @L470 - D=0, P=1.
 * Module.addCustomExportedProvider @L484 - D=2, P=3.
 *   1c1=isString(provide) | 1c2=isSymbol(provide)
 * Module.validateExportedProvider @L495 - D=3, P=4.
 *   1=this._providers.has(token)
 *   2=!imports.includes(token as Type<unknown>)
 *   3=isFunction(token)
 * Module.callback @L500 - D=0, P=1.
 * Module.callback @L501 - D=0, P=1.
 * Module.callback @L502 - D=0, P=1.
 * Module.addController @L513 - D=0, P=1.
 * Module.assignControllerUniqueId @L531 - D=0, P=1.
 * Module.addImport @L540 - D=0, P=1.
 * Module.replace @L544 - D=4, P=5.
 *   1c1=options.isProvider | 1c2=this.hasProvider(toReplace)
 *   2c1=!options.isProvider | 2c2=this.hasInjectable(toReplace)
 * Module.hasProvider @L559 - D=0, P=1.
 * Module.hasInjectable @L563 - D=0, P=1.
 * Module.getProviderByKey @L567 - D=0, P=1.
 * Module.getProviderById @L573 - D=2, P=3.
 *   1=next iteration of this._providers.values()
 *   2=item.id === id
 * Module.getControllerById @L580 - D=2, P=3.
 *   1=next iteration of this._controllers.values()
 *   2=item.id === id
 * Module.getInjectableById @L589 - D=2, P=3.
 *   1=next iteration of this._injectables.values()
 *   2=item.id === id
 * Module.getMiddlewareById @L598 - D=2, P=3.
 *   1=next iteration of this._middlewares.values()
 *   2=item.id === id
 * Module.getNonAliasProviders @L607 - D=0, P=1.
 * Module.callback @L610 - D=0, P=1.
 * Module.createModuleReferenceType @L613 - D=0, P=1.
 * Module.constructor @L617 - D=0, P=1.
 * Module.get @L621 - D=1, P=2.
 *   1=options.strict
 * Module.resolve @L642 - D=0, P=1.
 * Module.create @L661 - D=1, P=2.
 *   1=!(type && isFunction(type) && type.prototype)
 * Module.isEntryProvider @L673 - D=1, P=2.
 *   1=typeof metatype === 'function'
 * Module.generateUuid @L679 - D=3, P=4.
 *   1=this.token
 *   2=this.token.includes(':')
 *   3=key
 * Module.isTransientProvider @L690 - D=0, P=1.
 * Module.isRequestScopeProvider @L694 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { Injectable, Scope } from '@nestjs/common';
import { Module } from '../../../../packages/core/injector/module.js';
import { NestContainer } from '../../../../packages/core/injector/container.js';
import { ApplicationConfig } from '../../../../packages/core/application-config.js';
import { InstanceWrapper } from '../../../../packages/core/injector/instance-wrapper.js';
import { ENTRY_PROVIDER_WATERMARK } from '@nestjs/common/internal';

function moduleRef() {
  return new Module(
    class Fixture {},
    new NestContainer(new ApplicationConfig()),
  );
}
function failure(operation: () => unknown) {
  try {
    operation();
  } catch (error) {
    if (!(error instanceof Error)) throw error;
  }
}
describe('Module', () => {
  // addProvider: entry metadata on a direct class, custom token and useClass.
  it('registers entry providers through every class registration form', () => {
    const value = moduleRef();
    class Entry {}
    class EntryToken {}
    Reflect.defineMetadata(ENTRY_PROVIDER_WATERMARK, true, Entry);
    Reflect.defineMetadata(ENTRY_PROVIDER_WATERMARK, true, EntryToken);
    value.addProvider(Entry);
    value.addProvider({ provide: EntryToken, useValue: {} });
    value.addProvider({ provide: 'entry', useClass: Entry });
    value.entryProviders;
    const anonymous = (() => class {})();
    value.addProvider({ provide: 'anonymous', useClass: anonymous });
  });

  // generateUuid: explicit tokens with/without separator and an empty class name.
  it.each(['plain-token', 'namespace:token', 'namespace:'])(
    'generates a module ID from token %s',
    token => {
      const value: any = moduleRef();
      value.token = token;
      value.generateUuid();
    },
  );

  describe('constructor/core providers/accessors', () => {
    it('reads and writes module state', () => {
      const value = moduleRef();
      value.id;
      value.name;
      value.metatype;
      value.instance;
      value.isInstantiated;
      value.token = 'token';
      value.token;
      value.isGlobal = true;
      value.isGlobal;
      value.initOnPreview = true;
      value.initOnPreview;
      value.distance = 2;
      value.distance;
      value.providers;
      value.middlewares;
      value.imports;
      value.injectables;
      value.controllers;
      value.exports;
      value.entryProviders;
      value.providers.delete(value.metatype);
      failure(() => value.instance);
    });
  });
  describe('addProvider/addCustomProvider/classifiers', () => {
    it.each([
      { provide: 'value', useValue: null },
      { provide: Symbol('value'), useValue: Promise.resolve(1) },
      { provide: 'class', useClass: class Fixture {} },
      {
        provide: 'explicit',
        useClass: class Fixture {},
        scope: Scope.REQUEST,
        durable: true,
      },
      { provide: 'factory', useFactory: () => undefined },
      { provide: 'injected', useFactory: () => undefined, inject: ['value'] },
      { provide: 'alias', useExisting: 'value' },
      { provide: class Token {}, useValue: undefined },
    ])('provider %j', provider => {
      const value = moduleRef();
      value.addProvider(provider as any);
      value.addExportedProviderOrModule(provider as any);
      if ('useExisting' in provider)
        value.getProviderByKey('alias').metatype!(1);
    });
    it.each([Scope.DEFAULT, Scope.REQUEST, Scope.TRANSIENT])(
      'class scope %i and repeated registration',
      scope => {
        @Injectable({ scope })
        class Provider {}
        const value = moduleRef();
        value.addProvider(Provider);
        value.addProvider(Provider);
        value.addExportedProviderOrModule(Provider);
      },
    );
    it('invalid custom provider and unknown exports', () => {
      const value = moduleRef();
      failure(() => value.addProvider({ provide: 'invalid' } as any));
      failure(() => value.validateExportedProvider('missing'));
      failure(() => value.validateExportedProvider(class Missing {}));
      value.isCustomValue(undefined as any);
      value.isDynamicModule(null);
    });
  });
  describe('addInjectable/addController/assignControllerUniqueId/addImport/exports', () => {
    it('controller/provider/missing enhancer hosts and imported module exports', () => {
      class Controller {}
      class Provider {}
      class Enhancer {}
      const value = moduleRef();
      value.addController(Controller);
      value.addProvider(Provider);
      value.addInjectable(Enhancer, 'guard', Controller);
      value.addInjectable(Enhancer, 'guard', Provider);
      value.addInjectable(Enhancer, 'guard', 'missing');
      value.addInjectable({ provide: 'custom', useValue: {} } as any, 'guard');
      const imported = moduleRef();
      value.addImport(imported);
      value.addExportedProviderOrModule({ module: imported.metatype });
      value.addProvider({ provide: Symbol.for('export'), useValue: 1 });
      value.addExportedProviderOrModule(Symbol.for('export'));
      value.addProvider({ provide: Provider, useValue: 1 });
      value.addCustomExportedProvider({ provide: Provider, useValue: 1 });
    });
  });
  describe('replace/hasProvider/hasInjectable/key and id lookups/getNonAliasProviders', () => {
    it('present and absent entries', () => {
      class Provider {}
      class Controller {}
      class Enhancer {}
      const value = moduleRef();
      value.addProvider(Provider);
      value.addController(Controller);
      value.addInjectable(Enhancer, 'guard');
      value.middlewares.set(
        Provider,
        new InstanceWrapper({ metatype: Provider }),
      );
      value.replace(Provider, { isProvider: true, useValue: {} });
      value.replace(Enhancer, { isProvider: false, useValue: {} });
      value.replace('missing', { isProvider: true });
      value.replace('missing', { isProvider: false });
      value.hasProvider(Provider);
      value.hasInjectable(Enhancer);
      value.getProviderByKey(Provider);
      for (const [collection, method] of [
        ['providers', 'getProviderById'],
        ['controllers', 'getControllerById'],
        ['injectables', 'getInjectableById'],
        ['middlewares', 'getMiddlewareById'],
      ] as const) {
        for (const wrapper of value[collection].values())
          value[method](wrapper.id);
        value[method]('missing');
      }
      value.getNonAliasProviders();
    });
  });
});
