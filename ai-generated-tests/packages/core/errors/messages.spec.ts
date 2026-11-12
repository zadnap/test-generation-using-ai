/**
 * CFT checklist extracted from packages/core/errors/messages.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * getInstanceName @L13 - D=2, P=3.
 *   1=(instance as ForwardReference)?.forwardRef
 *   2=(instance as DynamicModule)?.module
 * getDependencyName @L34 - D=5, P=6.
 *   1c1=getInstanceName(dependency) | 1c2=isSymbol(dependency) | 1c3=dependency.toString() | 1c4=dependency ? disambiguated ? `"${dependency as string}"` : (dependency as string) : undefined | 1c5=fallbackValue
 * getModuleName @L57 - D=3, P=4.
 *   1c1=module | 1c2=getInstanceName(module.metatype) | 1c3='current'
 * stringifyScope @L60 - D=2, P=3.
 *   1c1=scope | 1c2=[]
 * UNKNOWN_DEPENDENCIES_MESSAGE @L63 - D=14, P=15.
 *   1c1=!isNil(index) | 1c2=dependencies | 1c3=dependencies[index] === undefined | 1c4=dependencies[index] === Object | 1c5=typeof dependencies[index] === 'function' | 1c6=(dependencies[index] as any).name === 'Object'
 *   2=isImportTypeIssue
 *   3=moduleName !== 'current'
 *   4=isNil(index)
 *   5c1=dependencies | 5c2=[]
 *   6c1=!isImportTypeIssue | 6c2=name !== undefined
 *   7=isImportTypeIssue
 * callback @L125 - D=0, P=1.
 * MISSING_DECORATOR_METADATA_MESSAGE @L143 - D=0, P=1.
 * INVALID_MIDDLEWARE_MESSAGE @L155 - D=0, P=1.
 * UNDEFINED_FORWARDREF_MESSAGE @L160 - D=0, P=1.
 * INVALID_MODULE_MESSAGE @L168 - D=4, P=5.
 *   1c1=getInstanceName(parentModule) | 1c2='module'
 *   2=receivedValue === null
 *   3=typeof receivedValue === 'string'
 * USING_INVALID_CLASS_AS_A_MODULE_MESSAGE @L196 - D=3, P=4.
 *   1=case 'controller'
 *   2=case 'provider'
 *   3=case 'filter'
 * UNDEFINED_MODULE_MESSAGE @L222 - D=2, P=3.
 *   1c1=getInstanceName(parentModule) | 1c2='module'
 * UNDEFINED_MODULE_ENTRY_MESSAGE @L239 - D=2, P=3.
 *   1c1=getInstanceName(parentModule) | 1c2='module'
 * INVALID_PROVIDER_MESSAGE @L255 - D=0, P=1.
 * UNKNOWN_EXPORT_MESSAGE @L265 - D=1, P=2.
 *   1=isSymbol(token)
 * INVALID_CLASS_MESSAGE @L280 - D=0, P=1.
 * INVALID_CLASS_SCOPE_MESSAGE @L283 - D=2, P=3.
 *   1c1=name | 1c2='This class'
 * REQUEST_SCOPED_CREATE_MESSAGE @L291 - D=0, P=1.
 * REQUEST_SCOPED_GLOBAL_ENHANCER_MESSAGE @L294 - D=0, P=1.
 * UNINSTANTIATED_GLOBAL_ENHANCER_MESSAGE @L307 - D=0, P=1.
 * UNKNOWN_REQUEST_MAPPING @L313 - D=1, P=2.
 *   1=className
 * ROUTE_CONFLICT_MESSAGE @L320 - D=0, P=1.
 * callback @L323 - D=0, P=1.
 * DUPLICATE_ROUTE_MESSAGE @L327 - D=0, P=1.
 * SHADOWED_ROUTE_MESSAGE @L335 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { forwardRef } from '@nestjs/common';
import * as messages from '../../../../packages/core/errors/messages.js';
describe('core error messages', () => {
  describe('UNKNOWN_DEPENDENCIES_MESSAGE and name/scope helpers', () => {
    it.each([
      undefined,
      Object,
      Object.defineProperty(function Custom() {}, 'name', { value: 'Object' }),
      class Service {},
      'token',
      Symbol('token'),
      forwardRef(() => class Forward {}),
      { module: class Dynamic {} },
      null,
    ])('dependency %s', dependency => {
      for (const moduleRef of [undefined, { metatype: class Root {} }])
        messages.UNKNOWN_DEPENDENCIES_MESSAGE(
          'Fixture',
          { index: 0, name: dependency, dependencies: [dependency] } as any,
          moduleRef as any,
        );
    });
    it('property injection and missing dependency list', () => {
      messages.UNKNOWN_DEPENDENCIES_MESSAGE(
        'Fixture',
        { key: Symbol('field') } as any,
        undefined,
      );
      messages.UNKNOWN_DEPENDENCIES_MESSAGE(
        'Fixture',
        { index: 0 } as any,
        undefined,
      );
    });
  });
  describe('other exported messages', () => {
    it('calls each message factory with concrete source signatures', () => {
      messages.MISSING_DECORATOR_METADATA_MESSAGE('Fixture', 0);
      messages.INVALID_MIDDLEWARE_MESSAGE([''] as any, 'Fixture');
      messages.UNDEFINED_FORWARDREF_MESSAGE(undefined as any);
      for (const value of [null, 'text', false])
        messages.INVALID_MODULE_MESSAGE(undefined, 0, [], value);
      for (const kind of ['provider', 'controller', 'filter'] as const)
        messages.USING_INVALID_CLASS_AS_A_MODULE_MESSAGE(
          class Fixture {},
          [],
          kind,
        );
      messages.UNDEFINED_MODULE_MESSAGE(undefined, 0, []);
      messages.UNDEFINED_MODULE_ENTRY_MESSAGE(undefined, 'providers', 0);
      messages.INVALID_PROVIDER_MESSAGE('token', 'Fixture');
      messages.UNKNOWN_EXPORT_MESSAGE('token', 'Fixture');
      messages.INVALID_CLASS_MESSAGE([''] as any, 'Fixture');
      messages.INVALID_CLASS_SCOPE_MESSAGE([''] as any, 'Fixture');
      messages.REQUEST_SCOPED_CREATE_MESSAGE('Fixture');
      for (const kind of ['useClass', 'useExisting', 'useFactory'] as const)
        messages.REQUEST_SCOPED_GLOBAL_ENHANCER_MESSAGE(
          'APP_GUARD',
          'Fixture',
          kind,
        );
      messages.UNINSTANTIATED_GLOBAL_ENHANCER_MESSAGE('APP_GUARD', 'Fixture');
      messages.UNKNOWN_REQUEST_MAPPING(class Fixture {});
      messages.ROUTE_CONFLICT_MESSAGE(['fixture']);
      messages.DUPLICATE_ROUTE_MESSAGE('GET', '/', 'a', 'b');
      messages.SHADOWED_ROUTE_MESSAGE('GET', '/a', 'a', '/b', 'b');
    });
  });
});
