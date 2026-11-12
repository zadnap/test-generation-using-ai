/**
 * CFT checklist extracted from packages/core/pipes/pipes-context-creator.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * PipesContextCreator.constructor @L18 - D=0, P=1.
 * PipesContextCreator.create @L25 - D=0, P=1.
 * PipesContextCreator.createConcreteContext @L42 - D=1, P=2.
 *   1=isEmpty(metadata)
 * PipesContextCreator.callback @L52 - D=3, P=4.
 *   1c1=pipe | 1c2=isFunction(pipe) | 1c3=isFunction(pipe.transform)
 * PipesContextCreator.callback @L54 - D=0, P=1.
 * PipesContextCreator.callback @L55 - D=3, P=4.
 *   1c1=!!pipe | 1c2=pipe.transform | 1c3=isFunction(pipe.transform)
 * PipesContextCreator.getPipeInstance @L59 - D=4, P=5.
 *   1=isObject
 *   2=!instanceWrapper
 *   3c1=instanceHost | 3c2=instanceHost.instance
 * PipesContextCreator.getInstanceByMetatype @L79 - D=2, P=3.
 *   1=!this.moduleContext
 *   2=!moduleRef
 * PipesContextCreator.getGlobalMetadata @L93 - D=3, P=4.
 *   1=!this.config
 *   2c1=contextId === STATIC_CONTEXT | 2c2=!inquirerId
 * PipesContextCreator.callback @L107 - D=0, P=1.
 * PipesContextCreator.callback @L113 - D=0, P=1.
 * PipesContextCreator.callback @L114 - D=0, P=1.
 * PipesContextCreator.setModuleContext @L120 - D=0, P=1.
 */
import { afterEach, describe, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { PIPES_METADATA } from '@nestjs/common/internal';
import { PipesContextCreator } from '../../../../packages/core/pipes/pipes-context-creator.js';
import { ApplicationConfig } from '../../../../packages/core/application-config.js';
import { STATIC_CONTEXT } from '../../../../packages/core/injector/constants.js';
import { InstanceWrapper } from '../../../../packages/core/injector/instance-wrapper.js';

afterEach(() => vi.restoreAllMocks());
describe('PipesContextCreator', () => {
  describe('create/createConcreteContext/instance lookup', () => {
    it('metadata empty, malformed, instance, class, missing class and wrapper instance absent', () => {
      vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      class Enhancer {
        transform() {
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
            instance: { transform: 1 },
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
      const creator: any = new PipesContextCreator(
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
      creator.getPipeInstance?.(new Enhancer());
      creator.getPipeInstance?.(Enhancer);
      creator.getPipeInstance?.(EmptyEnhancer);
      creator.getPipeInstance?.(Missing);
      Reflect.defineMetadata(PIPES_METADATA, [new Enhancer()], Controller);
      Reflect.defineMetadata(
        PIPES_METADATA,
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
      new PipesContextCreator(container).getGlobalMetadata();
      const config: any = new ApplicationConfig();
      config.useGlobalPipes({ transform: () => undefined });
      config.addGlobalRequestPipe(
        new InstanceWrapper({ instance: { transform: () => undefined } }),
      );
      config.addGlobalRequestPipe({
        isDependencyTreeDurable: () => false,
        getInstanceByContextId: () => null,
      });
      const creator: any = new PipesContextCreator(
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
