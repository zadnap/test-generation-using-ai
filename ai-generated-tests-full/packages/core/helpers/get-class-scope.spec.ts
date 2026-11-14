import { describe, expect, it } from 'vitest';
import { SCOPE_OPTIONS_METADATA } from '../../../../packages/common/constants.js';
import { Scope } from '../../../../packages/common/interfaces/scope-options.interface.js';
import { getClassScope } from '../../../../packages/core/helpers/get-class-scope.js';

describe('getClassScope', () => {
  it('xc1(T): returns the configured scope', () => {
    class Provider {}
    Reflect.defineMetadata(
      SCOPE_OPTIONS_METADATA,
      { scope: Scope.REQUEST },
      Provider,
    );

    expect(getClassScope(Provider)).toBe(Scope.REQUEST);
  });

  it('xc1(F): returns undefined without metadata', () => {
    class Provider {}

    expect(getClassScope(Provider)).toBeUndefined();
  });

  it('xc1(F): returns undefined when metadata has no scope', () => {
    class Provider {}
    Reflect.defineMetadata(SCOPE_OPTIONS_METADATA, {}, Provider);

    expect(getClassScope(Provider)).toBeUndefined();
  });
});
