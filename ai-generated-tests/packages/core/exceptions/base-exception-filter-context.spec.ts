/**
 * CFT checklist extracted from packages/core/exceptions/base-exception-filter-context.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * BaseExceptionFilterContext.constructor @L16 - D=0, P=1.
 * BaseExceptionFilterContext.createConcreteContext @L20 - D=1, P=2.
 *   1=isEmpty(metadata)
 * BaseExceptionFilterContext.callback @L30 - D=3, P=4.
 *   1c1=instance | 1c2=isFunction(instance.catch) | 1c3=isFunction(instance)
 * BaseExceptionFilterContext.callback @L33 - D=0, P=1.
 * BaseExceptionFilterContext.callback @L34 - D=0, P=1.
 * BaseExceptionFilterContext.callback @L35 - D=0, P=1.
 * BaseExceptionFilterContext.getFilterInstance @L42 - D=4, P=5.
 *   1=isObject
 *   2=!instanceWrapper
 *   3c1=instanceHost | 3c2=instanceHost.instance
 * BaseExceptionFilterContext.getInstanceByMetatype @L62 - D=2, P=3.
 *   1=!this.moduleContext
 *   2=!moduleRef
 * BaseExceptionFilterContext.reflectCatchExceptions @L76 - D=2, P=3.
 *   1c1=Reflect.getMetadata(FILTER_CATCH_EXCEPTIONS, prototype.constructor) | 1c2=[]
 */
import { describe, it } from 'vitest';
import { Catch } from '@nestjs/common';
import { BaseExceptionFilterContext } from '../../../../packages/core/exceptions/base-exception-filter-context.js';
import { NestContainer } from '../../../../packages/core/injector/container.js';
import { InstanceWrapper } from '../../../../packages/core/injector/instance-wrapper.js';
describe('BaseExceptionFilterContext', () => {
  it('concrete metadata, filter instance lookup, catch metadata and missing hosts', async () => {
    @Catch(Error)
    class Filter {
      catch() {}
    }
    class Missing {}
    const container = new NestContainer();
    const ref = (await container.addModule(class Root {}, []))!.moduleRef;
    ref.injectables.set(
      Filter,
      new InstanceWrapper({ metatype: Filter, instance: new Filter() }),
    );
    const value: any = new BaseExceptionFilterContext(container);
    value.getInstanceByMetatype(Filter);
    value.moduleContext = 'missing';
    value.getInstanceByMetatype(Filter);
    value.moduleContext = ref.token;
    value.createConcreteContext([]);
    value.createConcreteContext([null, {}, Filter, new Filter(), Missing]);
    value.getFilterInstance(Missing);
    ref.injectables.set(Missing, {
      isDependencyTreeDurable: () => false,
      getInstanceByContextId: () => null,
    } as any);
    value.getFilterInstance(Missing);
    value.reflectCatchExceptions({ catch() {} });
  });
});
