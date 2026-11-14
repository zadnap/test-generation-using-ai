import { describe, expect, it } from 'vitest';
import {
  getClassRef,
  registerClassRef,
} from '../../../../packages/core/helpers/class-ref-registry.js';

describe('class-ref-registry', () => {
  it('xc1(T): returns the registered class for an instance prototype', () => {
    class Registered {}
    registerClassRef(Registered);

    expect(getClassRef(new Registered())).toBe(Registered);
  });

  it('xc1(F): falls back to the constructor for unregistered classes', () => {
    class Unregistered {}

    expect(getClassRef(new Unregistered())).toBe(Unregistered);
  });

  it('xc1(F): ignores functions without a prototype', () => {
    const arrow = (() => undefined) as any;

    expect(() => registerClassRef(arrow)).not.toThrow();
  });
});
