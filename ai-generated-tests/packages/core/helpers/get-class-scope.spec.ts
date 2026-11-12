/**
 * CFT checklist extracted from packages/core/helpers/get-class-scope.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * getClassScope @L5 - D=2, P=3.
 *   1c1=metadata | 1c2=metadata.scope
 */
import { describe, it } from 'vitest';
import { Scope } from '@nestjs/common';
import { SCOPE_OPTIONS_METADATA } from '@nestjs/common/internal';
import { getClassScope } from '../../../../packages/core/helpers/get-class-scope.js';

describe('getClassScope', () => {
  it.each([undefined, {}, { scope: Scope.REQUEST }])(
    'metadata %j, 1(F/T)',
    metadata => {
      class Provider {}
      if (metadata !== undefined)
        Reflect.defineMetadata(SCOPE_OPTIONS_METADATA, metadata, Provider);
      getClassScope(Provider);
    },
  );
});
