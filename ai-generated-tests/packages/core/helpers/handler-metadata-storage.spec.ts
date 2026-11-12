/**
 * CFT checklist extracted from packages/core/helpers/handler-metadata-storage.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * HandlerMetadataStorage.set @L56 - D=2, P=3.
 *   1=!ctor
 *   2=!handlers
 * HandlerMetadataStorage.get @L69 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { HandlerMetadataStorage } from '../../../../packages/core/helpers/handler-metadata-storage.js';

describe('HandlerMetadataStorage', () => {
  describe('set/get', () => {
    it('missing constructor, first class entry, existing class entry and misses', () => {
      const storage = new HandlerMetadataStorage<any, any>();
      class Controller {}
      const instance = new Controller();
      storage.get(instance, 'first');
      storage.set(Object.create(null), 'first', {});
      storage.set(instance, 'first', { argsLength: 1 });
      storage.set(instance, 'second', { argsLength: 2 });
      storage.get(instance, 'first');
      storage.get(instance, 'missing');
    });
  });
});
