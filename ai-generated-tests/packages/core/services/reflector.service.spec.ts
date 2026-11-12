/**
 * CFT checklist extracted from packages/core/services/reflector.service.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * Reflector.createDecorator @L57 - D=0, P=1.
 * Reflector.decoratorFn @L62 - D=2, P=3.
 *   1=options.transform
 *   2=value === undefined
 * Reflector.callback @L63 - D=2, P=3.
 *   1=options.transform
 *   2=value === undefined
 * Reflector.get @L119 - D=0, P=1.
 * Reflector.getAll @L159 - D=2, P=3.
 *   1c1=targets | 1c2=[]
 * Reflector.callback @L163 - D=0, P=1.
 * Reflector.getAllAndMerge @L201 - D=3, P=4.
 *   1=isEmptyArray(metadataCollection)
 *   2=metadataCollection.length === 1
 *   3=isObject(value)
 * Reflector.callback @L208 - D=0, P=1.
 * Reflector.callback @L220 - D=4, P=5.
 *   1=Array.isArray(a)
 *   2c1=isObject(a) | 2c2=isObject(b) | 2c3=!Array.isArray(b)
 * Reflector.getAllAndOverride @L263 - D=2, P=3.
 *   1=next iteration of targets
 *   2=result !== undefined
 */
import { describe, it } from 'vitest';
import { Reflector } from '../../../../packages/core/services/reflector.service.js';

describe('Reflector', () => {
  describe('createDecorator/get', () => {
    it.each([
      [{}, undefined],
      [{ key: 'named' }, null],
      [{ transform: (x: unknown) => x }, 0],
      [{ transform: () => null }, 'input'],
      [{ transform: () => undefined }, 'input'],
    ])('options %j value %s', (options, value) => {
      const decorator = Reflector.createDecorator(options as any);
      class Target {
        method() {}
      }
      decorator(value)(Target);
      decorator(value)(
        Target.prototype,
        'method',
        Object.getOwnPropertyDescriptor(Target.prototype, 'method'),
      );
      const reflector = new Reflector();
      reflector.get(decorator, Target);
      reflector.get(decorator.KEY, Target.prototype.method);
    });
    it('uses default decorator options', () => {
      Reflector.createDecorator()(undefined)(class Target {});
    });
  });
  describe('getAll', () => {
    it.each([undefined, []])('empty targets %s', targets => {
      new Reflector().getAll('k', targets as any);
    });
  });
  describe('getAllAndMerge', () => {
    // Filter undefined. Empty/single/reduce. Reducer covers array, object/object,
    // object/scalar, object/array and scalar first accumulator.
    it.each(
      [
        [],
        [undefined],
        [1],
        [null],
        [{}],
        [[1]],
        [[1], [2]],
        [{ a: 1 }, { b: 2 }],
        [{}, 1],
        [{}, [1]],
        [1, {}],
        [null, {}],
      ].map(values => ({ values })),
    )('metadata $values', ({ values }) => {
      const targets = values.map(value => {
        const target = () => undefined;
        Reflect.defineMetadata('k', value, target);
        return target;
      });
      new Reflector().getAllAndMerge('k', targets);
    });
  });
  describe('getAllAndOverride', () => {
    it.each(
      [[], [undefined], [undefined, false], [null, 1]].map(values => ({
        values,
      })),
    )('metadata $values', ({ values }) => {
      const targets = values.map(value => {
        const target = () => undefined;
        Reflect.defineMetadata('k', value, target);
        return target;
      });
      new Reflector().getAllAndOverride('k', targets);
    });
  });
});
