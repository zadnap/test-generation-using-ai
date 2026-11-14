import { describe, expect, it } from 'vitest';
import {
  isClassProvider,
  isFactoryProvider,
  isValueProvider,
} from '../../../../../packages/core/injector/helpers/provider-classifier.js';

describe('provider-classifier', () => {
  it('xc1(T): detects class providers', () => {
    expect(isClassProvider({ provide: 'x', useClass: class {} } as any)).toBe(
      true,
    );
  });

  it('xc1(F): rejects non-class providers', () => {
    expect(isClassProvider({ provide: 'x', useValue: 1 } as any)).toBe(false);
    expect(isClassProvider(null as any)).toBe(false);
  });

  it('xc2(T): detects value providers', () => {
    expect(isValueProvider({ provide: 'x', useValue: 1 } as any)).toBe(true);
    expect(isValueProvider({ provide: 'x', useValue: null } as any)).toBe(true);
    expect(isValueProvider({ provide: 'x', useValue: 0 } as any)).toBe(true);
  });

  it('xc2(F): rejects providers whose useValue is undefined', () => {
    expect(
      isValueProvider({ provide: 'x', useValue: undefined } as any),
    ).toBe(false);
    expect(isValueProvider({ provide: 'x' } as any)).toBe(false);
  });

  it('xc3(T): detects factory providers', () => {
    expect(
      isFactoryProvider({ provide: 'x', useFactory: () => 1 } as any),
    ).toBe(true);
  });

  it('xc3(F): rejects non-factory providers', () => {
    expect(isFactoryProvider({ provide: 'x', useValue: 1 } as any)).toBe(false);
  });
});
