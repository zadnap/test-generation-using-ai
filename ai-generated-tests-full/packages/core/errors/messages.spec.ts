import { describe, expect, it } from 'vitest';
import {
  DUPLICATE_ROUTE_MESSAGE,
  INVALID_CLASS_MESSAGE,
  INVALID_CLASS_SCOPE_MESSAGE,
  INVALID_EXCEPTION_FILTER,
  INVALID_MIDDLEWARE_CONFIGURATION,
  INVALID_MIDDLEWARE_MESSAGE,
  INVALID_MODULE_MESSAGE,
  INVALID_PROVIDER_MESSAGE,
  MICROSERVICES_PACKAGE_NOT_FOUND_EXCEPTION,
  MISSING_DECORATOR_METADATA_MESSAGE,
  REQUEST_SCOPED_CREATE_MESSAGE,
  REQUEST_SCOPED_GLOBAL_ENHANCER_MESSAGE,
  ROUTE_CONFLICT_MESSAGE,
  SHADOWED_ROUTE_MESSAGE,
  UNDEFINED_FORWARDREF_MESSAGE,
  UNDEFINED_MODULE_ENTRY_MESSAGE,
  UNDEFINED_MODULE_MESSAGE,
  UNHANDLED_RUNTIME_EXCEPTION,
  UNINSTANTIATED_GLOBAL_ENHANCER_MESSAGE,
  UNKNOWN_DEPENDENCIES_MESSAGE,
  UNKNOWN_EXPORT_MESSAGE,
  UNKNOWN_REQUEST_MAPPING,
  USING_INVALID_CLASS_AS_A_MODULE_MESSAGE,
} from '../../../../packages/core/errors/messages.js';

class Foo {}

describe('UNKNOWN_DEPENDENCIES_MESSAGE', () => {
  it('xc1(T): describes a property dependency', () => {
    const message = UNKNOWN_DEPENDENCIES_MESSAGE(
      'MyClass',
      { key: 'httpClient' },
      undefined,
    );

    expect(message).toContain('Nest can\'t resolve dependencies of the MyClass');
    expect(message).toContain('"httpClient" property');
    expect(message).toContain('current Module');
  });

  it('xc2(T): explains an import type issue for an undefined dependency', () => {
    const message = UNKNOWN_DEPENDENCIES_MESSAGE(
      'MyClass',
      { index: 0, name: 'Foo', dependencies: [undefined] as any },
      undefined,
    );

    expect(message).toContain('import type');
    expect(message).toContain('argument at index [0]');
    expect(message).toContain('current module');
  });

  it('xc2(T): explains an import type issue for Object', () => {
    const message = UNKNOWN_DEPENDENCIES_MESSAGE(
      'MyClass',
      { index: 0, name: 'Foo', dependencies: [Object] as any },
      undefined,
    );

    expect(message).toContain('import type');
  });

  it('xc2(T): explains an import type issue for a function named Object', () => {
    const ObjectLike = function Object() {};

    const message = UNKNOWN_DEPENDENCIES_MESSAGE(
      'MyClass',
      { index: 0, name: 'Foo', dependencies: [ObjectLike] as any },
      undefined,
    );

    expect(message).toContain('import type');
  });

  it('xc2(F), xc3(T): names the module in the potential solutions', () => {
    const moduleRef = { metatype: class CatsModule {} } as any;

    const message = UNKNOWN_DEPENDENCIES_MESSAGE(
      'MyClass',
      { index: 0, name: 'Foo', dependencies: [Foo] as any },
      moduleRef,
    );

    expect(message).toContain('CatsModule');
    expect(message).toContain('argument "Foo" at index [0]');
    expect(message).toContain('is available in the CatsModule module');
  });

  it('xc3(F): falls back to the current module', () => {
    const message = UNKNOWN_DEPENDENCIES_MESSAGE(
      'MyClass',
      { index: 0, name: 'Foo', dependencies: [Foo] as any },
      undefined,
    );

    expect(message).toContain('is available in the current module');
  });

  it('xc4(T): includes the token when a name is present', () => {
    const message = UNKNOWN_DEPENDENCIES_MESSAGE(
      'MyClass',
      { index: 0, name: Foo, dependencies: [Foo] as any },
      undefined,
    );

    expect(message).toContain('argument Foo at index [0]');
  });

  it('xc4(F): omits the token when the name is missing', () => {
    const message = UNKNOWN_DEPENDENCIES_MESSAGE(
      'MyClass',
      { index: 0, dependencies: [Foo] as any },
      undefined,
    );

    expect(message).toContain('argument at index [0]');
  });

  it('resolves forward references, dynamic modules and symbols', () => {
    const forwardRef = { forwardRef: () => Foo };
    const dynamicModule = { module: class DynamicModule {} };
    const symbol = Symbol('TOKEN');

    expect(
      UNKNOWN_DEPENDENCIES_MESSAGE(
        'MyClass',
        { index: 0, name: forwardRef as any, dependencies: [Foo] as any },
        undefined,
      ),
    ).toContain('argument Foo at index [0]');
    expect(
      UNKNOWN_DEPENDENCIES_MESSAGE(
        'MyClass',
        { index: 0, name: dynamicModule as any, dependencies: [Foo] as any },
        undefined,
      ),
    ).toContain('argument DynamicModule at index [0]');
    expect(
      UNKNOWN_DEPENDENCIES_MESSAGE(
        'MyClass',
        { index: 0, name: symbol, dependencies: [Foo] as any },
        undefined,
      ),
    ).toContain(symbol.toString());
  });
});

describe('other dependency messages', () => {
  it('formats the missing decorator metadata message', () => {
    expect(MISSING_DECORATOR_METADATA_MESSAGE('MyClass', 2)).toContain(
      'argument at index [2]',
    );
  });

  it('formats the invalid middleware message', () => {
    expect(INVALID_MIDDLEWARE_MESSAGE`${'Middleware'}`).toBe(
      "The middleware doesn't provide the 'use' method (Middleware)",
    );
  });

  it('formats the undefined forward reference message', () => {
    const message = UNDEFINED_FORWARDREF_MESSAGE([Foo]);

    expect(message).toContain('Scope [Foo]');
    expect(message).toContain('forwardRef()');
  });

  it('formats the invalid module message for null', () => {
    const message = INVALID_MODULE_MESSAGE(class ParentModule {}, 0, [Foo], null);

    expect(message).toContain('ParentModule');
    expect(message).toContain('`null` is of type "null"');
    expect(message).toContain('Scope [Foo]');
  });

  it('formats the invalid module message for a string', () => {
    const message = INVALID_MODULE_MESSAGE('Parent', 1, [], 'value');

    expect(message).toContain('`"value"` is of type "string"');
  });

  it('formats the invalid module message for other values', () => {
    const message = INVALID_MODULE_MESSAGE('Parent', 2, [], 42);

    expect(message).toContain('`42` is of type "number"');
  });

  it('uses the module fallback name', () => {
    const message = INVALID_MODULE_MESSAGE(undefined, 0, [], null);

    expect(message).toContain('Nest cannot create the module instance');
  });

  it('xc1(T): explains controllers used as modules', () => {
    const message = USING_INVALID_CLASS_AS_A_MODULE_MESSAGE(
      Foo,
      [Foo],
      'controller',
    );

    expect(message).toContain('@Controller()');
    expect(message).toContain('"Foo"');
  });

  it('xc1(F), xc2(T): explains providers used as modules', () => {
    const message = USING_INVALID_CLASS_AS_A_MODULE_MESSAGE(
      Foo,
      [],
      'provider',
    );

    expect(message).toContain('@Injectable()');
  });

  it('xc2(F): explains filters used as modules', () => {
    const message = USING_INVALID_CLASS_AS_A_MODULE_MESSAGE(
      Foo,
      [],
      'filter',
    );

    expect(message).toContain('@Catch()');
  });

  it('formats the undefined module message', () => {
    const message = UNDEFINED_MODULE_MESSAGE(class ParentModule {}, 1, [Foo]);

    expect(message).toContain('ParentModule');
    expect(message).toContain('index [1]');
    expect(message).toContain('Scope [Foo]');
  });

  it('uses the module fallback name for undefined modules', () => {
    expect(UNDEFINED_MODULE_MESSAGE(undefined, 0, [])).toContain(
      'Nest cannot create the module instance',
    );
  });

  it('formats the undefined module entry message', () => {
    expect(
      UNDEFINED_MODULE_ENTRY_MESSAGE(class ParentModule {}, 'providers', 0),
    ).toContain('The provider at index [0]');
    expect(
      UNDEFINED_MODULE_ENTRY_MESSAGE(class ParentModule {}, 'controllers', 1),
    ).toContain('The controller at index [1]');
    expect(
      UNDEFINED_MODULE_ENTRY_MESSAGE(class ParentModule {}, 'exports', 2),
    ).toContain('The export at index [2]');
  });

  it('formats the invalid provider message', () => {
    const message = INVALID_PROVIDER_MESSAGE('TOKEN', 'CatsModule');

    expect(message).toContain('"TOKEN"');
    expect(message).toContain('CatsModule');
  });

  it('xc1(T): formats the unknown export message for a symbol', () => {
    const token = Symbol('TOKEN');

    expect(UNKNOWN_EXPORT_MESSAGE(token, 'CatsModule')).toContain(
      token.toString(),
    );
  });

  it('xc1(F): formats the unknown export message for a string', () => {
    expect(UNKNOWN_EXPORT_MESSAGE('TOKEN', 'CatsModule')).toContain('TOKEN');
  });

  it('uses the default unknown export token', () => {
    expect(UNKNOWN_EXPORT_MESSAGE(undefined as any, 'CatsModule')).toContain(
      'item',
    );
  });

  it('formats the invalid class message', () => {
    expect(INVALID_CLASS_MESSAGE`${'value'}`).toBe(
      'ModuleRef cannot instantiate class (value is not constructable).',
    );
  });

  it('xc1(T): names the class in the invalid class scope message', () => {
    expect(INVALID_CLASS_SCOPE_MESSAGE`${'Foo'}`).toContain('Foo is marked');
  });

  it('xc1(F): falls back to "This class" in the invalid class scope message', () => {
    expect(INVALID_CLASS_SCOPE_MESSAGE`${undefined}`).toContain(
      'This class is marked',
    );
  });

  it('formats the request scoped create message', () => {
    expect(REQUEST_SCOPED_CREATE_MESSAGE('Foo')).toContain('Foo depends on');
  });

  it('xc1(T): explains useClass request-scoped enhancers', () => {
    expect(
      REQUEST_SCOPED_GLOBAL_ENHANCER_MESSAGE('APP_GUARD', 'Foo', 'useClass'),
    ).toContain('dependencies undefined');
  });

  it('xc1(F), xc2(T): explains useExisting request-scoped enhancers', () => {
    expect(
      REQUEST_SCOPED_GLOBAL_ENHANCER_MESSAGE(
        'APP_GUARD',
        'Foo',
        'useExisting',
      ),
    ).toContain('never run');
  });

  it('xc2(F): explains useFactory request-scoped enhancers', () => {
    expect(
      REQUEST_SCOPED_GLOBAL_ENHANCER_MESSAGE(
        'APP_GUARD',
        'Foo',
        'useFactory',
      ),
    ).toContain('factory provider');
  });

  it('formats the uninstantiated global enhancer message', () => {
    expect(
      UNINSTANTIATED_GLOBAL_ENHANCER_MESSAGE('APP_GUARD', 'Foo'),
    ).toContain('was not instantiated');
  });

  it('xc1(T): names an invalid controller', () => {
    expect(UNKNOWN_REQUEST_MAPPING(Foo)).toContain('"Foo"');
  });

  it('xc1(F): handles an anonymous invalid controller', () => {
    const Anonymous = class {};
    Object.defineProperty(Anonymous, 'name', { value: '' });

    expect(UNKNOWN_REQUEST_MAPPING(Anonymous)).toContain(
      'one of your controllers is missing',
    );
  });

  it('formats the route conflict message', () => {
    expect(ROUTE_CONFLICT_MESSAGE(['GET /a', 'GET /b'])).toContain(
      '  - GET /a',
    );
  });

  it('formats duplicate and shadowed route messages', () => {
    expect(DUPLICATE_ROUTE_MESSAGE('GET', '/a', 'A', 'B')).toContain(
      'both A and B',
    );
    expect(SHADOWED_ROUTE_MESSAGE('GET', '/a', 'A', '/b', 'B')).toContain(
      'shadowed by GET /b (B)',
    );
  });

  it('exposes the static messages', () => {
    expect(INVALID_MIDDLEWARE_CONFIGURATION).toContain('configure()');
    expect(UNHANDLED_RUNTIME_EXCEPTION).toContain('Unhandled');
    expect(INVALID_EXCEPTION_FILTER).toContain('@UseFilters()');
    expect(MICROSERVICES_PACKAGE_NOT_FOUND_EXCEPTION).toContain(
      '@nestjs/microservices',
    );
  });
});
