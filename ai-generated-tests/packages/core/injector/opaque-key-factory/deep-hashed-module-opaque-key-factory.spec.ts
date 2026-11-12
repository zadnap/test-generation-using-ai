/**
 * CFT checklist extracted from packages/core/injector/opaque-key-factory/deep-hashed-module-opaque-key-factory.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * DeepHashedModuleOpaqueKeyFactory.createForStatic @L32 - D=1, P=2.
 *   1=this.moduleTokenCache.has(key)
 * DeepHashedModuleOpaqueKeyFactory.createForDynamic @L46 - D=1, P=2.
 *   1=timeSpentInMs > 10
 * DeepHashedModuleOpaqueKeyFactory.getStringifiedOpaqueToken @L71 - D=2, P=3.
 *   1=!opaqueToken
 *   2=tokenString !== UNSERIALIZABLE
 * DeepHashedModuleOpaqueKeyFactory.callback @L86 - D=2, P=3.
 *   1c1=value instanceof Map | 1c2=value instanceof Set
 * DeepHashedModuleOpaqueKeyFactory.getModuleId @L93 - D=1, P=2.
 *   1=moduleId
 * DeepHashedModuleOpaqueKeyFactory.getModuleName @L103 - D=0, P=1.
 * DeepHashedModuleOpaqueKeyFactory.hashString @L107 - D=0, P=1.
 * DeepHashedModuleOpaqueKeyFactory.replacer @L111 - D=6, P=7.
 *   1=isFunction(value)
 *   2=isClass
 *   3=isSymbol(value)
 *   4=value instanceof Map
 *   5=value instanceof Set
 *   6=value instanceof RegExp
 */
import { afterEach, describe, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { DeepHashedModuleOpaqueKeyFactory } from '../../../../../packages/core/injector/opaque-key-factory/deep-hashed-module-opaque-key-factory.js';

afterEach(() => vi.restoreAllMocks());
describe('DeepHashedModuleOpaqueKeyFactory', () => {
  describe('static/dynamic/module caches/hash/replacer', () => {
    it('class/function/symbol/map/set/regexp/plain and cache paths', () => {
      class Fixture {}
      const factory = new DeepHashedModuleOpaqueKeyFactory();
      factory.createForStatic(Fixture);
      factory.createForStatic(Fixture);
      factory.getModuleId(Fixture);
      factory.getModuleName(Fixture);
      factory.getStringifiedOpaqueToken(undefined);
      factory.createForDynamic(Fixture, {
        providers: [
          {
            provide: Symbol('fixture'),
            useValue: [
              Fixture,
              () => undefined,
              new Map([['a', 1]]),
              new Set([1]),
              /fixture/,
            ],
          },
        ],
      });
    });
    it('slow serialization warning', () => {
      vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(11);
      new DeepHashedModuleOpaqueKeyFactory().createForDynamic(
        class Fixture {},
        {},
      );
    });
    it('cyclic collections fallback', () => {
      const map = new Map();
      map.set('self', map);
      const set = new Set();
      set.add(set);
      new DeepHashedModuleOpaqueKeyFactory().getStringifiedOpaqueToken({
        map,
        set,
      });
    });
  });
});
