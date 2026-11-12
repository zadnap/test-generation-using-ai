/**
 * CFT checklist extracted from packages/core/helpers/external-context-creator.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * ExternalContextCreator.constructor @L49 - D=0, P=1.
 * ExternalContextCreator.fromContainer @L60 - D=0, P=1.
 * ExternalContextCreator.create @L95 - D=6, P=7.
 *   1c1=this.getContextModuleKey(classRef) | 1c2=this.getHostModuleKey(instance, inquirerId)
 *   2=options.interceptors
 *   3=paramsMetadata
 *   4=options.guards
 *   5=options.filters
 * ExternalContextCreator.callback @L122 - D=2, P=3.
 *   1c1=item.token === classRef | 1c2=item.instance === instance
 * ExternalContextCreator.handler @L169 - D=1, P=2.
 *   1=fnApplyPipes
 * ExternalContextCreator.callback @L170 - D=1, P=2.
 *   1=fnApplyPipes
 * ExternalContextCreator.target @L178 - D=2, P=3.
 *   1c1=fnCanActivate | 1c2=await fnCanActivate(args)
 * ExternalContextCreator.getMetadata @L201 - D=3, P=4.
 *   1=cacheMetadata
 *   2c1=this.contextUtils.reflectCallbackMetadata<TMetadata>( instance, methodName, metadataKey || '', ) | 2c2={}
 * ExternalContextCreator.getParamsMetadata @L233 - D=1, P=2.
 *   1=paramsFactory
 * ExternalContextCreator.getContextModuleKey @L259 - D=3, P=4.
 *   1=!moduleCtor
 *   2=next iteration of moduleContainerEntries
 *   3=moduleRef.hasProvider(moduleCtor)
 * ExternalContextCreator.getHostModuleKey @L279 - D=3, P=4.
 *   1=next iteration of this.modulesContainer.entries()
 *   2=inquirerId
 *   3=host
 * ExternalContextCreator.callback @L284 - D=2, P=3.
 *   1c1=!wrapper.isAlias | 1c2=wrapper.instance === instance
 * ExternalContextCreator.exchangeKeysForValues @L293 - D=0, P=1.
 * ExternalContextCreator.callback @L304 - D=1, P=2.
 *   1=key.includes(CUSTOM_ROUTE_ARGS_METADATA)
 * ExternalContextCreator.extractValue @L330 - D=0, P=1.
 * ExternalContextCreator.createPipesFn @L337 - D=1, P=2.
 *   1=paramsOptions.length
 * ExternalContextCreator.pipesFn @L341 - D=0, P=1.
 * ExternalContextCreator.resolveParamValue @L342 - D=0, P=1.
 * ExternalContextCreator.getParamValue @L367 - D=1, P=2.
 *   1=isEmptyArray(pipes)
 * ExternalContextCreator.transformToResult @L377 - D=1, P=2.
 *   1=isObservable(resultOrDeferred)
 * ExternalContextCreator.createGuardsFn @L384 - D=1, P=2.
 *   1=guards.length
 * ExternalContextCreator.canActivateFn @L390 - D=1, P=2.
 *   1=!canActivate
 * ExternalContextCreator.registerRequestProvider @L405 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import {
  UseGuards,
  UsePipes,
  UseInterceptors,
  UseFilters,
  Catch,
} from '@nestjs/common';
import { CUSTOM_ROUTE_ARGS_METADATA } from '@nestjs/common/internal';
import { of } from 'rxjs';
import { ExternalContextCreator } from '../../../../packages/core/helpers/external-context-creator.js';
import { NestContainer } from '../../../../packages/core/injector/container.js';
import { ApplicationConfig } from '../../../../packages/core/application-config.js';
import { REQUEST } from '../../../../packages/core/router/request/request-constants.js';
import { STATIC_CONTEXT } from '../../../../packages/core/injector/constants.js';
import { ENTRY_PROVIDER_WATERMARK } from '@nestjs/common/internal';
describe('ExternalContextCreator', () => {
  // create's entryProviders.find: token match and instance match independently.
  it.each([false, true])(
    'finds an entry provider registered under a custom token %s',
    async customToken => {
      class OtherEntry {
        handle() {}
      }
      class Provider {
        handle() {
          return 'value';
        }
      }
      Reflect.defineMetadata(ENTRY_PROVIDER_WATERMARK, true, OtherEntry);
      Reflect.defineMetadata(ENTRY_PROVIDER_WATERMARK, true, Provider);
      const container = new NestContainer(new ApplicationConfig());
      const ref = (await container.addModule(class Root {}, []))!.moduleRef;
      ref.addProvider(OtherEntry);
      const token = customToken ? 'entry' : Provider;
      ref.addProvider(
        customToken ? { provide: token, useClass: Provider } : Provider,
      );
      const instance = new Provider();
      ref.getProviderByKey(token)!.instance = instance;
      const creator = ExternalContextCreator.fromContainer(container);
      await creator.create(instance, instance.handle, 'handle')();
    },
  );

  describe('fromContainer/create/getMetadata/exchangeKeysForValues/transformToResult/guard and pipe helpers', () => {
    it.each([true, false])('context options %s', async enabled => {
      class IdentityPipe {
        transform(value: unknown) {
          return value;
        }
      }
      class Interceptor {
        intercept(_ctx: any, next: any) {
          return next.handle();
        }
      }
      @Catch()
      class Filter {
        catch() {
          return 'handled';
        }
      }
      class Provider {
        @UseGuards({ canActivate: () => true })
        @UsePipes(new IdentityPipe())
        @UseInterceptors(new Interceptor())
        @UseFilters(new Filter())
        handle(...args: any[]) {
          return of(args);
        }
      }
      const container = new NestContainer(new ApplicationConfig());
      const ref = (await container.addModule(class Root {}, []))!.moduleRef;
      ref.addProvider(Provider);
      const instance = new Provider();
      ref.getProviderByKey(Provider).instance = instance;
      ref.addProvider({ provide: REQUEST, useValue: undefined });
      container.registerCoreModuleRef(ref);
      const creator: any = ExternalContextCreator.fromContainer(container);
      const key = 'fixture-args';
      const custom = 'custom' + CUSTOM_ROUTE_ARGS_METADATA + ':1';
      Reflect.defineMetadata(
        key,
        {
          '3:0': { index: 0, data: 'field', pipes: [new IdentityPipe()] },
          [custom]: {
            index: 1,
            data: 'custom',
            factory: () => 'custom',
            pipes: [],
          },
        },
        Provider,
        'handle',
      );
      const paramsFactory = {
        exchangeKeyForValue: (_type: any, _data: any, args: any) => args[0],
      };
      const handler = creator.create(
        instance,
        instance.handle,
        'handle',
        key,
        paramsFactory,
        STATIC_CONTEXT,
        undefined,
        { guards: enabled, interceptors: enabled, filters: enabled },
        'rpc',
      );
      await handler('value');
      await handler('second');
      const metadata = creator.getMetadata(
        instance,
        'handle',
        key,
        paramsFactory,
        'rpc',
      );
      metadata.getParamsMetadata(ref.token);
      creator.getMetadata(instance, 'handle').getParamsMetadata(ref.token);
      creator
        .exchangeKeysForValues(
          ['3:0'],
          { '3:0': { index: 0, data: 'field', pipes: [] } },
          ref.token,
          paramsFactory,
        )[0]
        .extractValue('value');
      creator.createPipesFn([], []);
      await creator.getParamValue('value', { type: 'custom' }, []);
      await creator.transformToResult('value');
      creator.getContextModuleKey(undefined);
      creator.getContextModuleKey(class Missing {});
      creator.getHostModuleKey(instance);
      creator.getHostModuleKey(instance, ref.getProviderByKey(Provider).id);
      creator.getHostModuleKey({}, 'missing');
      await creator.create({}, () => undefined, 'unknown')();
      for (const canActivate of [true, false]) {
        const guard = creator.createGuardsFn(
          [{ canActivate: () => canActivate }],
          {},
          () => undefined,
        );
        try {
          await guard([]);
        } catch (error) {
          if (!(error instanceof Error)) throw error;
        }
      }
      creator.registerRequestProvider({}, { id: 1 });
    });
  });
});
