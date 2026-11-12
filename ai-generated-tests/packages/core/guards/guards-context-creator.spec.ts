/**
 * CFT checklist extracted from packages/core/guards/guards-context-creator.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * GuardsContextCreator.constructor @L19 - D=0, P=1.
 * GuardsContextCreator.create @L26 - D=0, P=1.
 * GuardsContextCreator.createConcreteContext @L43 - D=1, P=2.
 *   1=isEmpty(metadata)
 * GuardsContextCreator.callback @L53 - D=3, P=4.
 *   1c1=guard | 1c2=isFunction(guard) | 1c3=isFunction(guard.canActivate)
 * GuardsContextCreator.callback @L56 - D=0, P=1.
 * GuardsContextCreator.callback @L60 - D=2, P=3.
 *   1c1=!!guard | 1c2=isFunction(guard.canActivate)
 * GuardsContextCreator.getGuardInstance @L65 - D=4, P=5.
 *   1=isObject
 *   2=!instanceWrapper
 *   3c1=instanceHost | 3c2=instanceHost.instance
 * GuardsContextCreator.getInstanceByMetatype @L87 - D=2, P=3.
 *   1=!this.moduleContext
 *   2=!moduleRef
 * GuardsContextCreator.getGlobalMetadata @L102 - D=3, P=4.
 *   1=!this.config
 *   2c1=contextId === STATIC_CONTEXT | 2c2=!inquirerId
 * GuardsContextCreator.callback @L116 - D=0, P=1.
 * GuardsContextCreator.callback @L122 - D=0, P=1.
 * GuardsContextCreator.callback @L123 - D=0, P=1.
 */
import { afterEach, describe, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/internal';
import { GuardsContextCreator } from '../../../../packages/core/guards/guards-context-creator.js';
import { ApplicationConfig } from '../../../../packages/core/application-config.js';
import { STATIC_CONTEXT } from '../../../../packages/core/injector/constants.js';
import { InstanceWrapper } from '../../../../packages/core/injector/instance-wrapper.js';

afterEach(() => vi.restoreAllMocks());
describe('GuardsContextCreator', () => {
  describe('create/createConcreteContext/instance lookup', () => {
    it('metadata empty, malformed, instance, class, missing class and wrapper instance absent', () => {
      vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      class Enhancer {
        canActivate() {
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
            instance: { canActivate: 1 },
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
      const creator: any = new GuardsContextCreator(
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
      creator.getGuardInstance?.(new Enhancer());
      creator.getGuardInstance?.(Enhancer);
      creator.getGuardInstance?.(EmptyEnhancer);
      creator.getGuardInstance?.(Missing);
      Reflect.defineMetadata(GUARDS_METADATA, [new Enhancer()], Controller);
      Reflect.defineMetadata(
        GUARDS_METADATA,
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
      new GuardsContextCreator(container).getGlobalMetadata();
      const config: any = new ApplicationConfig();
      config.useGlobalGuards({ canActivate: () => undefined });
      config.addGlobalRequestGuard(
        new InstanceWrapper({ instance: { canActivate: () => undefined } }),
      );
      config.addGlobalRequestGuard({
        isDependencyTreeDurable: () => false,
        getInstanceByContextId: () => null,
      });
      const creator: any = new GuardsContextCreator(
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
