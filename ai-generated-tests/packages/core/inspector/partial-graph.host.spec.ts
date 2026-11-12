/**
 * CFT checklist extracted from packages/core/inspector/partial-graph.host.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * PartialGraphHost.toJSON @L6 - D=0, P=1.
 * PartialGraphHost.toString @L10 - D=0, P=1.
 * PartialGraphHost.register @L14 - D=0, P=1.
 */
import { afterEach, describe, it } from 'vitest';
import { PartialGraphHost } from '../../../../packages/core/inspector/partial-graph.host.js';
import { SerializedGraph } from '../../../../packages/core/inspector/serialized-graph.js';
afterEach(() => PartialGraphHost.register(undefined as any));
describe('PartialGraphHost', () => {
  it('register/toJSON/toString with and without graph', () => {
    PartialGraphHost.register(undefined as any);
    PartialGraphHost.toJSON();
    PartialGraphHost.toString();
    PartialGraphHost.register(new SerializedGraph());
    PartialGraphHost.toJSON();
    PartialGraphHost.toString();
  });
});
