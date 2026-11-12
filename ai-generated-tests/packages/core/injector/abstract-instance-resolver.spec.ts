/**
 * CFT checklist extracted from packages/core/injector/abstract-instance-resolver.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * AbstractInstanceResolver.find @L21 - D=1, P=2.
 *   1=Array.isArray(instanceLinkOrArray)
 * AbstractInstanceResolver.pluckInstance @L29 - D=3, P=4.
 *   1c1=wrapperRef.scope === Scope.REQUEST | 1c2=wrapperRef.scope === Scope.TRANSIENT | 1c3=!wrapperRef.isDependencyTreeStatic()
 * AbstractInstanceResolver.resolvePerContext @L45 - D=2, P=3.
 *   1=options?.strict
 *   2=Array.isArray(instanceLinkOrArray)
 * AbstractInstanceResolver.pluckInstance @L60 - D=5, P=6.
 *   1c1=wrapperRef.isDependencyTreeStatic() | 1c2=!wrapperRef.isTransient
 *   2c1=wrapperRef.instance | 2c2={ constructor: typeOrToken }
 *   3=!instance
 * AbstractInstanceResolver.callback @L82 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { Scope } from '@nestjs/common';
import { AbstractInstanceResolver } from '../../../../packages/core/injector/abstract-instance-resolver.js';
import { InstanceWrapper } from '../../../../packages/core/injector/instance-wrapper.js';
describe('AbstractInstanceResolver', () => {
  it.each([
    { scope: Scope.DEFAULT },
    { scope: Scope.REQUEST },
    { scope: Scope.TRANSIENT },
    { scope: Scope.DEFAULT, requestTree: true },
  ])('find/resolvePerContext %j', async ({ scope, requestTree }) => {
    class Fixture extends (AbstractInstanceResolver as any) {}
    const wrapper = new InstanceWrapper({
      scope,
      metatype: class Provider {},
      instance: {},
    });
    if (requestTree)
      wrapper.addCtorMetadata(0, new InstanceWrapper({ scope: Scope.REQUEST }));
    const link = { wrapperRef: wrapper, collection: new Map() };
    const value: any = new Fixture();
    value.instanceLinksHost = {
      get: (_token: any, options: any) => (options.each ? [link] : link),
    };
    value.injector = { loadPerContext: async () => ({}) };
    for (const each of [false, true]) {
      try {
        value.find('fixture', { each });
      } catch (error) {
        if (!(error instanceof Error)) throw error;
      }
      await value.resolvePerContext(
        'fixture',
        { id: 'fixture' },
        { id: 1 },
        { each, strict: each },
      );
    }
    wrapper.instance = null;
    value.injector = { loadPerContext: async () => null };
    try {
      await value.resolvePerContext('fixture', { id: 'fixture' }, { id: 1 });
    } catch (error) {
      if (!(error instanceof Error)) throw error;
    }
  });
});
