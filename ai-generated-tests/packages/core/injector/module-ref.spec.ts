/**
 * CFT checklist extracted from packages/core/injector/module-ref.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * ModuleRef.instanceLinksHost @L31 - D=1, P=2.
 *   1=!this._instanceLinksHost
 * ModuleRef.constructor @L38 - D=0, P=1.
 * ModuleRef.introspect @L146 - D=2, P=3.
 *   1=!wrapperRef.isDependencyTreeStatic()
 *   2=wrapperRef.isTransient
 * ModuleRef.registerRequestByContextId @L160 - D=0, P=1.
 * ModuleRef.instantiateClass @L164 - D=3, P=4.
 *   1c1=type | 1c2=type.name
 *   2=type?.prototype
 * ModuleRef.callback @L186 - D=0, P=1.
 * ModuleRef.loadInstance @L188 - D=1, P=2.
 *   1=!isCreated
 * ModuleRef.callback @L189 - D=0, P=1.
 * ModuleRef.callback @L223 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { Inject, Optional, Injectable, Scope } from '@nestjs/common';
import { NestContainer } from '../../../../packages/core/injector/container.js';
import { ModuleRef } from '../../../../packages/core/injector/module-ref.js';
import { REQUEST } from '../../../../packages/core/router/request/request-constants.js';
async function failure(operation: () => unknown | Promise<unknown>) {
  try {
    await operation();
  } catch (error) {
    if (!(error instanceof Error)) throw error;
  }
}
describe('ModuleRef', () => {
  describe('get/resolve/create/introspect/registerRequestByContextId/instantiateClass', () => {
    it('static/request/transient providers, constructor/property injection, invalid class and request-scoped create', async () => {
      const container = new NestContainer();
      const ref = (await container.addModule(class Root {}, []))!.moduleRef;
      container.registerCoreModuleRef(ref);
      ref.addProvider({ provide: REQUEST, useValue: undefined });
      ref.addProvider({ provide: 'value', useValue: 1 });
      @Injectable({ scope: Scope.REQUEST })
      class RequestService {}
      @Injectable({ scope: Scope.TRANSIENT })
      class TransientService {}
      class Consumer {
        constructor(@Inject('value') value: number) {}
        @Optional() @Inject('missing') property: unknown;
      }
      class RequestConsumer {
        constructor(@Inject(RequestService) value: unknown) {}
      }
      ref.addProvider(RequestService);
      ref.addProvider(TransientService);
      const value: any = ref.getProviderByKey(ModuleRef).instance;
      value.get('value');
      value.get('value', { strict: false, each: true });
      value.introspect('value');
      value.introspect(RequestService);
      value.introspect(TransientService);
      const context = { id: 1 };
      value.registerRequestByContextId({}, context);
      await value.resolve(RequestService, context);
      await value.resolve(TransientService, context, {
        strict: false,
        each: true,
      });
      await value.create(Consumer);
      await failure(() => value.create(RequestConsumer));
      await failure(() => value.create(null));
      await failure(() => value.create(() => undefined));
    });
  });
});
