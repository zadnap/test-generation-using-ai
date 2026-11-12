/**
 * CFT checklist extracted from packages/core/metadata-scanner.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * MetadataScanner.scanFromPrototype @L16 - D=10, P=11.
 *   1=!prototype
 *   2c1=prototype = Reflect.getPrototypeOf(prototype) | 2c2=prototype !== Object.prototype
 *   3=next iteration of Object.getOwnPropertyNames(prototype)
 *   4=visitedNames.has(property)
 *   5c1=descriptor.set | 5c2=descriptor.get | 5c3=isConstructor(property) | 5c4=!isFunction(prototype[property])
 *   6=isNil(value)
 * MetadataScanner.getAllFilteredMethodNames @L72 - D=0, P=1.
 * MetadataScanner.getAllMethodNames @L78 - D=10, P=11.
 *   1=!prototype
 *   2=this.cachedScannedPrototypes.has(prototype)
 *   3c1=prototype = Reflect.getPrototypeOf(prototype) | 3c2=prototype !== Object.prototype
 *   4=next iteration of Object.getOwnPropertyNames(prototype)
 *   5=visitedNames.has(property)
 *   6c1=descriptor!.set | 6c2=descriptor!.get | 6c3=isConstructor(property) | 6c4=!isFunction(prototype[property])
 */
import { describe, it } from 'vitest';
import { MetadataScanner } from '../../../packages/core/metadata-scanner.js';

class Parent {
  shared() {}
  parent() {}
}
class Child extends Parent {
  shared() {}
  own() {}
  get getter() {
    throw new Error('accessor must be skipped');
  }
  set setter(value: unknown) {}
}
Object.defineProperty(Child.prototype, 'data', { value: 3 });

describe('MetadataScanner', () => {
  describe('scanFromPrototype', () => {
    // Descriptor decision 3c1(set),3c2(get),3c3(constructor),3c4(non-function).
    // Hierarchy, duplicate names, nil callback and ordinary results are exercised.
    it.each([null, Child.prototype, Object.create(null)])(
      'prototype %s',
      prototype => {
        new MetadataScanner().scanFromPrototype(
          new Child(),
          prototype,
          name => name,
        );
      },
    );
    it.each([null, undefined, false, 0])('callback returns %s', value => {
      new MetadataScanner().scanFromPrototype(
        new Child(),
        Child.prototype,
        () => value,
      );
    });
  });
  describe('getAllMethodNames', () => {
    it.each([null, Child.prototype, Object.create(null)])(
      'prototype %s, cold and cached',
      prototype => {
        const scanner = new MetadataScanner();
        scanner.getAllMethodNames(prototype);
        scanner.getAllMethodNames(prototype);
      },
    );
  });
  describe('getAllFilteredMethodNames', () => {
    it('consumes the generator', () => {
      Array.from(
        new MetadataScanner().getAllFilteredMethodNames(Child.prototype),
      );
    });
  });
});
