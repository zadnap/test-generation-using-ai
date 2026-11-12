/**
 * CFT checklist extracted from packages/core/router/router-exception-filters.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * RouterExceptionFilters.constructor @L22 - D=0, P=1.
 * RouterExceptionFilters.create @L30 - D=1, P=2.
 *   1=isEmptyArray(filters)
 * RouterExceptionFilters.getGlobalMetadata @L54 - D=2, P=3.
 *   1c1=contextId === STATIC_CONTEXT | 1c2=!inquirerId
 * RouterExceptionFilters.callback @L66 - D=0, P=1.
 * RouterExceptionFilters.callback @L72 - D=0, P=1.
 * RouterExceptionFilters.callback @L73 - D=0, P=1.
 * RouterExceptionFilters.warnAboutScopedGlobalFilters @L84 - D=2, P=3.
 *   1c1=isEmptyArray(this.config.getGlobalRequestFilters()) | 1c2=RouterExceptionFilters.warnedConfigs.has(this.config)
 */
import { afterEach, describe, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { EXCEPTION_FILTERS_METADATA } from '@nestjs/common/internal';
import { RouterExceptionFilters } from '../../../../packages/core/router/router-exception-filters.js';
import { ApplicationConfig } from '../../../../packages/core/application-config.js';
import { STATIC_CONTEXT } from '../../../../packages/core/injector/constants.js';
import { InstanceWrapper } from '../../../../packages/core/injector/instance-wrapper.js';

afterEach(() => vi.restoreAllMocks());
describe('RouterExceptionFilters', () => {
  describe('create/createConcreteContext/instance lookup', () => {
    it('metadata empty, malformed, instance, class, missing class and wrapper instance absent', () => {
      vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      class Enhancer {
        catch() {
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
            instance: { catch: 1 },
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
      const creator: any = new RouterExceptionFilters(
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

      creator.getFilterInstance?.(new Enhancer());
      creator.getFilterInstance?.(Enhancer);
      creator.getFilterInstance?.(EmptyEnhancer);
      creator.getFilterInstance?.(Missing);
      Reflect.defineMetadata(
        EXCEPTION_FILTERS_METADATA,
        [new Enhancer()],
        Controller,
      );
      Reflect.defineMetadata(
        EXCEPTION_FILTERS_METADATA,
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

      const config: any = new ApplicationConfig();
      config.useGlobalFilters({ catch: () => undefined });
      config.addGlobalRequestFilter(
        new InstanceWrapper({ instance: { catch: () => undefined } }),
      );
      config.addGlobalRequestFilter({
        isDependencyTreeDurable: () => false,
        getInstanceByContextId: () => null,
      });
      const creator: any = new RouterExceptionFilters(
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
