/**
 * CFT checklist extracted from packages/core/helpers/is-durable.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * isDurable @L4 - D=2, P=3.
 *   1c1=metadata | 1c2=metadata.durable
 */
import { describe, it } from 'vitest';
import { SCOPE_OPTIONS_METADATA } from '@nestjs/common/internal';
import { isDurable } from '../../../../packages/core/helpers/is-durable.js';

describe('isDurable', () => {
  it.each([undefined, {}, { durable: true }, { durable: false }])(
    'metadata %j, 1(F/T)',
    metadata => {
      class Provider {}
      if (metadata !== undefined)
        Reflect.defineMetadata(SCOPE_OPTIONS_METADATA, metadata, Provider);
      isDurable(Provider);
    },
  );
});
