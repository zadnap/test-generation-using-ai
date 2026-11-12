/**
 * CFT checklist extracted from packages/core/router/paths-explorer.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * PathsExplorer.constructor @L24 - D=0, P=1.
 * PathsExplorer.scanForPaths @L26 - D=1, P=2.
 *   1=isUndefined(prototype)
 * PathsExplorer.callback @L36 - D=1, P=2.
 *   1=route
 * PathsExplorer.exploreMethodMetadata @L51 - D=2, P=3.
 *   1=isUndefined(routePath)
 *   2=isString(routePath)
 * PathsExplorer.callback @L72 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { Get } from '@nestjs/common';
import { PathsExplorer } from '../../../../packages/core/router/paths-explorer.js';
import { MetadataScanner } from '../../../../packages/core/metadata-scanner.js';
describe('PathsExplorer', () => {
  it('scanForPaths/exploreMethodMetadata missing/string/array route paths', () => {
    class Fixture {
      @Get('one') first() {}
      @Get(['two', 'three']) second() {}
      plain() {}
    }
    const explorer = new PathsExplorer(new MetadataScanner());
    explorer.scanForPaths(new Fixture());
    explorer.scanForPaths(new Fixture(), Fixture.prototype);
  });
});
