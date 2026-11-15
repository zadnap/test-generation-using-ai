import { describe, expect, it } from 'vitest';
import {
  CATCH_WATERMARK,
  CONTROLLER_WATERMARK,
  CUSTOM_ROUTE_ARGS_METADATA,
  ENHANCER_KEY_TO_SUBTYPE_MAP,
  ENTRY_PROVIDER_WATERMARK,
  EXCEPTION_FILTERS_METADATA,
  FILTER_CATCH_EXCEPTIONS,
  GLOBAL_MODULE_METADATA,
  GUARDS_METADATA,
  HEADERS_METADATA,
  HOST_METADATA,
  HTTP_CODE_METADATA,
  INJECTABLE_WATERMARK,
  INTERCEPTORS_METADATA,
  METHOD_METADATA,
  MODULE_METADATA,
  MODULE_PATH,
  OPTIONAL_DEPS_METADATA,
  OPTIONAL_PROPERTY_DEPS_METADATA,
  PARAMTYPES_METADATA,
  PATH_METADATA,
  PIPES_METADATA,
  PROPERTY_DEPS_METADATA,
  REDIRECT_METADATA,
  RENDER_METADATA,
  RESPONSE_PASSTHROUGH_METADATA,
  ROUTE_ARGS_METADATA,
  SCOPE_OPTIONS_METADATA,
  SELF_DECLARED_DEPS_METADATA,
  SSE_METADATA,
  SSE_OPTIONS_METADATA,
  VERSION_METADATA,
} from '../../../packages/common/constants.js';

/**
 * `constants.ts` has no decision node: every export is a constant value, so
 * the module has exactly one independent path. The table only makes sure each
 * exported constant is evaluated and has the expected metadata key.
 */
describe('common constants (C3: 0 decision nodes, 1 path)', () => {
  it('groups the module metadata keys', () => {
    expect(MODULE_METADATA).toEqual({
      IMPORTS: 'imports',
      PROVIDERS: 'providers',
      CONTROLLERS: 'controllers',
      EXPORTS: 'exports',
    });
  });

  it.each([
    [GLOBAL_MODULE_METADATA, '__module:global__'],
    [HOST_METADATA, 'host'],
    [PATH_METADATA, 'path'],
    [PARAMTYPES_METADATA, 'design:paramtypes'],
    [SELF_DECLARED_DEPS_METADATA, 'self:paramtypes'],
    [OPTIONAL_DEPS_METADATA, 'optional:paramtypes'],
    [PROPERTY_DEPS_METADATA, 'self:properties_metadata'],
    [OPTIONAL_PROPERTY_DEPS_METADATA, 'optional:properties_metadata'],
    [SCOPE_OPTIONS_METADATA, 'scope:options'],
    [METHOD_METADATA, 'method'],
    [ROUTE_ARGS_METADATA, '__routeArguments__'],
    [CUSTOM_ROUTE_ARGS_METADATA, '__customRouteArgs__'],
    [FILTER_CATCH_EXCEPTIONS, '__filterCatchExceptions__'],
    [PIPES_METADATA, '__pipes__'],
    [GUARDS_METADATA, '__guards__'],
    [INTERCEPTORS_METADATA, '__interceptors__'],
    [EXCEPTION_FILTERS_METADATA, '__exceptionFilters__'],
    [RENDER_METADATA, '__renderTemplate__'],
    [HTTP_CODE_METADATA, '__httpCode__'],
    [MODULE_PATH, '__module_path__'],
    [HEADERS_METADATA, '__headers__'],
    [REDIRECT_METADATA, '__redirect__'],
    [RESPONSE_PASSTHROUGH_METADATA, '__responsePassthrough__'],
    [SSE_METADATA, '__sse__'],
    [SSE_OPTIONS_METADATA, '__sseOptions__'],
    [VERSION_METADATA, '__version__'],
    [INJECTABLE_WATERMARK, '__injectable__'],
    [CONTROLLER_WATERMARK, '__controller__'],
    [CATCH_WATERMARK, '__catch__'],
    [ENTRY_PROVIDER_WATERMARK, '__entryProvider__'],
  ])('exposes %s as %s', (value, expected) => {
    expect(value).toBe(expected);
  });

  it('maps every enhancer metadata key to its subtype', () => {
    expect(ENHANCER_KEY_TO_SUBTYPE_MAP).toEqual({
      [GUARDS_METADATA]: 'guard',
      [INTERCEPTORS_METADATA]: 'interceptor',
      [PIPES_METADATA]: 'pipe',
      [EXCEPTION_FILTERS_METADATA]: 'filter',
    });
  });

  it('builds the enhancer map from the exported metadata keys', () => {
    expect(Object.keys(ENHANCER_KEY_TO_SUBTYPE_MAP)).toEqual([
      GUARDS_METADATA,
      INTERCEPTORS_METADATA,
      PIPES_METADATA,
      EXCEPTION_FILTERS_METADATA,
    ]);
  });
});
