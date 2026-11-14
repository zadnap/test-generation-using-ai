import { describe, expect, it } from 'vitest';
import {
  CUSTOM_ROUTE_ARGS_METADATA,
  ENHANCER_KEY_TO_SUBTYPE_MAP,
  EXCEPTION_FILTERS_METADATA,
  GUARDS_METADATA,
  INTERCEPTORS_METADATA,
  MODULE_METADATA,
  PIPES_METADATA,
} from '../../../packages/common/constants.js';

describe('common constants', () => {
  it('exposes module metadata keys', () => {
    expect(MODULE_METADATA).toEqual({
      IMPORTS: 'imports',
      PROVIDERS: 'providers',
      CONTROLLERS: 'controllers',
      EXPORTS: 'exports',
    });
  });

  it('maps enhancer metadata keys to their subtype', () => {
    expect(ENHANCER_KEY_TO_SUBTYPE_MAP[GUARDS_METADATA]).toBe('guard');
    expect(ENHANCER_KEY_TO_SUBTYPE_MAP[INTERCEPTORS_METADATA]).toBe(
      'interceptor',
    );
    expect(ENHANCER_KEY_TO_SUBTYPE_MAP[PIPES_METADATA]).toBe('pipe');
    expect(
      ENHANCER_KEY_TO_SUBTYPE_MAP[EXCEPTION_FILTERS_METADATA],
    ).toBe('filter');
  });

  it('exposes the route argument metadata key', () => {
    expect(CUSTOM_ROUTE_ARGS_METADATA).toBe('__customRouteArgs__');
  });
});
