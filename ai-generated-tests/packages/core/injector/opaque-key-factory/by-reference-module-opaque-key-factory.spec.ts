/**
 * CFT checklist extracted from packages/core/injector/opaque-key-factory/by-reference-module-opaque-key-factory.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * ByReferenceModuleOpaqueKeyFactory.constructor @L11 - D=0, P=1.
 * ByReferenceModuleOpaqueKeyFactory.createForStatic @L15 - D=0, P=1.
 * ByReferenceModuleOpaqueKeyFactory.createForDynamic @L22 - D=0, P=1.
 * ByReferenceModuleOpaqueKeyFactory.getOrCreateModuleId @L30 - D=3, P=4.
 *   1=Object.prototype.hasOwnProperty.call(originalRef, K_MODULE_ID)
 *   2=this.keyGenerationStrategy === 'random'
 *   3=dynamicMetadata
 * ByReferenceModuleOpaqueKeyFactory.hashString @L54 - D=0, P=1.
 * ByReferenceModuleOpaqueKeyFactory.generateRandomString @L58 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { ByReferenceModuleOpaqueKeyFactory } from '../../../../../packages/core/injector/opaque-key-factory/by-reference-module-opaque-key-factory.js';

describe('ByReferenceModuleOpaqueKeyFactory', () => {
  describe('createForStatic/createForDynamic/getOrCreateModuleId/hashString/generateRandomString', () => {
    it.each([undefined, 'random', 'shallow'] as const)(
      'strategy %s, cached/uncached/static/dynamic/subclass',
      strategy => {
        class Fixture {}
        class Derived extends Fixture {}
        const factory = new ByReferenceModuleOpaqueKeyFactory(
          strategy ? { keyGenerationStrategy: strategy } : undefined,
        );
        factory.createForStatic(Fixture);
        factory.createForStatic(Fixture);
        factory.createForStatic(Derived);
        const dynamic = { module: Fixture, providers: [] };
        factory.createForDynamic(Fixture, dynamic, dynamic);
        factory.createForDynamic(Fixture, dynamic, dynamic);
      },
    );
  });
});
