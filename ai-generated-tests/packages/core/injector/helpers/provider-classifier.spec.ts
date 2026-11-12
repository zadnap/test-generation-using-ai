/**
 * CFT checklist extracted from packages/core/injector/helpers/provider-classifier.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * isClassProvider @L9 - D=0, P=1.
 * isValueProvider @L15 - D=0, P=1.
 * isFactoryProvider @L22 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import {
  isClassProvider,
  isValueProvider,
  isFactoryProvider,
} from '../../../../../packages/core/injector/helpers/provider-classifier.js';

describe('provider classifiers', () => {
  describe('isClassProvider', () => {
    it.each([
      undefined,
      {},
      { useClass: class Provider {} },
      { useClass: null },
    ])('input %j', value => {
      isClassProvider(value as any);
    });
  });
  describe('isValueProvider', () => {
    it.each([
      undefined,
      {},
      { useValue: undefined },
      { useValue: null },
      { useValue: false },
    ])('input %j', value => {
      isValueProvider(value as any);
    });
  });
  describe('isFactoryProvider', () => {
    it.each([{}, { useFactory: () => undefined }, { useFactory: null }])(
      'input %j',
      value => {
        isFactoryProvider(value as any);
      },
    );
  });
});
