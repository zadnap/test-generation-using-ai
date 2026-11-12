/**
 * CFT checklist extracted from packages/core/helpers/messages.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * MODULE_INIT_MESSAGE @L4 - D=0, P=1.
 * ROUTE_MAPPED_MESSAGE @L9 - D=0, P=1.
 * VERSIONED_ROUTE_MAPPED_MESSAGE @L12 - D=1, P=2.
 *   1=Array.isArray(version)
 * callback @L19 - D=1, P=2.
 *   1=version === VERSION_NEUTRAL
 * CONTROLLER_MAPPING_MESSAGE @L25 - D=0, P=1.
 * VERSIONED_CONTROLLER_MAPPING_MESSAGE @L28 - D=1, P=2.
 *   1=Array.isArray(version)
 * callback @L35 - D=1, P=2.
 *   1=version === VERSION_NEUTRAL
 * INVALID_EXECUTION_CONTEXT @L41 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { VERSION_NEUTRAL } from '@nestjs/common';
import * as messages from '../../../../packages/core/helpers/messages.js';
describe('helper messages', () => {
  it('straight-line message functions', () => {
    messages.MODULE_INIT_MESSAGE([''] as any, 'Fixture');
    messages.ROUTE_MAPPED_MESSAGE('/', 0);
    messages.CONTROLLER_MAPPING_MESSAGE('Fixture', '/');
    messages.INVALID_EXECUTION_CONTEXT('run', 'http');
  });
  it.each(
    ['1', VERSION_NEUTRAL, ['1', VERSION_NEUTRAL]].map(version => ({
      version,
    })),
  )('versions $version', ({ version }) => {
    messages.VERSIONED_ROUTE_MAPPED_MESSAGE('/', 0, version);
    messages.VERSIONED_CONTROLLER_MAPPING_MESSAGE('Fixture', '/', version);
  });
});
