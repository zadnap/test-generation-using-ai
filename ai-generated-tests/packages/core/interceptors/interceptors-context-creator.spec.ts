/**
 * CFT checklist extracted from packages/core/interceptors/interceptors-context-creator.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * InterceptorsContextCreator.constructor @L18 - D=0, P=1.
 * InterceptorsContextCreator.create @L25 - D=0, P=1.
 * InterceptorsContextCreator.createConcreteContext @L42 - D=1, P=2.
 *   1=isEmpty(metadata)
 * InterceptorsContextCreator.callback @L52 - D=3, P=4.
 *   1c1=interceptor | 1c2=isFunction(interceptor) | 1c3=isFunction(interceptor.intercept)
 * InterceptorsContextCreator.callback @L56 - D=0, P=1.
 * InterceptorsContextCreator.callback @L59 - D=1, P=2.
 *   1=interceptor
 * InterceptorsContextCreator.getInterceptorInstance @L65 - D=4, P=5.
 *   1=isObject
 *   2=!instanceWrapper
 *   3c1=instanceHost | 3c2=instanceHost.instance
 * InterceptorsContextCreator.getInstanceByMetatype @L87 - D=2, P=3.
 *   1=!this.moduleContext
 *   2=!moduleRef
 * InterceptorsContextCreator.getGlobalMetadata @L101 - D=3, P=4.
 *   1=!this.config
 *   2c1=contextId === STATIC_CONTEXT | 2c2=!inquirerId
 * InterceptorsContextCreator.callback @L115 - D=0, P=1.
 * InterceptorsContextCreator.callback @L121 - D=0, P=1.
 * InterceptorsContextCreator.callback @L122 - D=0, P=1.
 */
import { afterEach, describe, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { INTERCEPTORS_METADATA } from '@nestjs/common/internal';
import { InterceptorsContextCreator } from '../../../../packages/core/interceptors/interceptors-context-creator.js';
import { ApplicationConfig } from '../../../../packages/core/application-config.js';
import { STATIC_CONTEXT } from '../../../../packages/core/injector/constants.js';
import { InstanceWrapper } from '../../../../packages/core/injector/instance-wrapper.js';

afterEach(() => vi.restoreAllMocks());
describe('InterceptorsContextCreator', () => {
  describe('create/createConcreteContext/instance lookup', () => {
    it('metadata empty, malformed, instance, class, missing class and wrapper instance absent', () => {
      vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      class Enhancer {
        intercept() {
          return true;
        }
      }
      class BadEnhancer {}
      class EmptyEnhancer {}
      class Missing {}
      class Controller {
        handle() {}
      }
      const config = new ApplicationConfig();
      const wrappers = new Map<any, any>([
        [
          Enhancer,
          new InstanceWrapper({ metatype: Enhancer, instance: new Enhancer() }),
        ],
        [
          BadEnhancer,
          new InstanceWrapper({
            metatype: BadEnhancer,
            instance: { intercept: 1 },
          }),
        ],
        [
          EmptyEnhancer,
          {
            isDependencyTreeDurable: () => false,
            getInstanceByContextId: () => undefined,
          },
        ],
      ]);
      const modules = new Map([['fixture', { injectables: wrappers }]]);
      const container: any = { getModules: () => modules };
      const creator: any = new InterceptorsContextCreator(
        container,
        config,
        {} as any,
      );
      creator.getInstanceByMetatype(Enhancer);
      creator.moduleContext = 'missing';
      creator.getInstanceByMetatype(Enhancer);
      creator.moduleContext = 'fixture';
      creator.getInstanceByMetatype(Enhancer);
      creator.createConcreteContext(undefined);
      creator.createConcreteContext([]);
      creator.createConcreteContext([
        null,
        {},
        new Enhancer(),
        Enhancer,
        Missing,
      ]);
      creator.createConcreteContext([BadEnhancer, EmptyEnhancer]);
      creator.getInterceptorInstance?.(new Enhancer());
      creator.getInterceptorInstance?.(Enhancer);
      creator.getInterceptorInstance?.(EmptyEnhancer);
      creator.getInterceptorInstance?.(Missing);
      Reflect.defineMetadata(
        INTERCEPTORS_METADATA,
        [new Enhancer()],
        Controller,
      );
      Reflect.defineMetadata(
        INTERCEPTORS_METADATA,
        [Enhancer],
        Controller.prototype.handle,
      );
      creator.create(new Controller(), Controller.prototype.handle, 'fixture');
      creator.create({}, () => undefined, 'missing');
      creator.setModuleContext?.('fixture');
    });
  });
  describe('getGlobalMetadata/getContextId', () => {
    it('configuration absent, static context, caller override and parent context', () => {
      vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const container: any = { getModules: () => new Map() };
      new InterceptorsContextCreator(container).getGlobalMetadata();
      const config: any = new ApplicationConfig();
      config.useGlobalInterceptors({ intercept: () => undefined });
      config.addGlobalRequestInterceptor(
        new InstanceWrapper({ instance: { intercept: () => undefined } }),
      );
      config.addGlobalRequestInterceptor({
        isDependencyTreeDurable: () => false,
        getInstanceByContextId: () => null,
      });
      const creator: any = new InterceptorsContextCreator(
        container,
        config,
        {} as any,
      );
      creator.getGlobalMetadata();
      creator.getGlobalMetadata();
      creator.getGlobalMetadata(STATIC_CONTEXT, 'caller');
      creator.getGlobalMetadata({ id: 1 });
      creator.getGlobalMetadata({ id: 2, getParent: () => STATIC_CONTEXT });
    });
  });
});
