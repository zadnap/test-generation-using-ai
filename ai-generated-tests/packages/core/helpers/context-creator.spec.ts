/**
 * CFT checklist extracted from packages/core/helpers/context-creator.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * ContextCreator.createContext @L17 - D=4, P=5.
 *   1c1=this.getGlobalMetadata | 1c2=this.getGlobalMetadata<T>(contextId, inquirerId)
 *   2c1=globalMetadata | 2c2=[] as unknown[] as T
 * ContextCreator.reflectClassMetadata @L44 - D=0, P=1.
 * ContextCreator.reflectMethodMetadata @L48 - D=0, P=1.
 * ContextCreator.getContextId @L55 - D=1, P=2.
 *   1=contextId.getParent
 */
import { describe, it } from 'vitest';
import { ContextCreator } from '../../../../packages/core/helpers/context-creator.js';
import { InstanceWrapper } from '../../../../packages/core/injector/instance-wrapper.js';
describe('ContextCreator', () => {
  it('global metadata absent, class/method reflection and parent-context resolution', () => {
    class Fixture extends (ContextCreator as any) {
      createConcreteContext(metadata: any) {
        return metadata || [];
      }
    }
    class Controller {
      handle() {}
    }
    const value: any = new Fixture();
    Reflect.defineMetadata('fixture', [1], Controller);
    Reflect.defineMetadata('fixture', [2], Controller.prototype.handle);
    value.createContext(
      new Controller(),
      Controller.prototype.handle,
      'fixture',
    );
    value.getContextId({ id: 1 }, new InstanceWrapper());
    value.getContextId(
      { id: 2, getParent: () => ({ id: 3 }) },
      new InstanceWrapper(),
    );
  });
});
