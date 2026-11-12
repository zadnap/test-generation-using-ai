/**
 * CFT checklist extracted from packages/core/inspector/initialize-on-preview.allowlist.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * InitializeOnPreviewAllowlist.add @L6 - D=0, P=1.
 * InitializeOnPreviewAllowlist.has @L10 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { InitializeOnPreviewAllowlist } from '../../../../packages/core/inspector/initialize-on-preview.allowlist.js';
describe('InitializeOnPreviewAllowlist', () => {
  it('add/has', () => {
    class Fixture {}
    InitializeOnPreviewAllowlist.has(Fixture);
    InitializeOnPreviewAllowlist.add(Fixture);
    InitializeOnPreviewAllowlist.has(Fixture);
  });
});
