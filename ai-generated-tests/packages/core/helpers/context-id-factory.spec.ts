/**
 * CFT checklist extracted from packages/core/helpers/context-id-factory.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * createContextId @L5 - D=0, P=1.
 * ContextIdFactory.create @L49 - D=0, P=1.
 * ContextIdFactory.getByRequest @L57 - D=6, P=7.
 *   1=!request
 *   2=request[REQUEST_CONTEXT_ID as any]
 *   3=next iteration of propsToInspect
 *   4=request[key]?.[REQUEST_CONTEXT_ID]
 *   5=!this.strategy
 *   6=this.isContextIdResolverWithPayload(resolverObjectOrFunction!)
 * ContextIdFactory.apply @L91 - D=0, P=1.
 * ContextIdFactory.isContextIdResolverWithPayload @L95 - D=0, P=1.
 */
import { afterEach, describe, it } from 'vitest';
import {
  ContextIdFactory,
  createContextId,
} from '../../../../packages/core/helpers/context-id-factory.js';
import { REQUEST_CONTEXT_ID } from '../../../../packages/core/router/request/request-constants.js';

describe('ContextIdFactory', () => {
  afterEach(() => {
    (ContextIdFactory as any).strategy = undefined;
  });
  describe('create/createContextId', () => {
    it('creates context identities', () => {
      createContextId();
      ContextIdFactory.create();
    });
  });
  describe('getByRequest', () => {
    it.each([
      undefined,
      null,
      {},
      { [REQUEST_CONTEXT_ID]: { id: 1 } },
      { raw: {} },
      { raw: { [REQUEST_CONTEXT_ID]: { id: 2 } } },
    ])('request %j, absent/existing/raw context paths', request => {
      ContextIdFactory.getByRequest(request as any);
    });
    it('inspects custom properties after an unmatched property', () => {
      ContextIdFactory.getByRequest(
        { transport: { [REQUEST_CONTEXT_ID]: { id: 3 } } },
        ['missing', 'transport'],
      );
    });
  });
  describe('apply/isContextIdResolverWithPayload via getByRequest', () => {
    it.each([
      undefined,
      () => ({ id: 4 }),
      { resolve: () => ({ id: 5 }), payload: { tenant: 1 } },
    ])('resolver %s, object/function/undefined', resolver => {
      ContextIdFactory.apply({ attach: () => resolver });
      const id = ContextIdFactory.getByRequest({});
      id.getParent?.({} as any);
    });
  });
});
