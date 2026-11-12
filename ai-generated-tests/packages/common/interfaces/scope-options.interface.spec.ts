import { describe, expect, it } from 'vitest';
import { Scope } from '../../../../packages/common/interfaces/scope-options.interface.js';

describe('Scope (C3)', () => {
  it.each([
    ['DEFAULT', Scope.DEFAULT, 0],
    ['TRANSIENT', Scope.TRANSIENT, 1],
    ['REQUEST', Scope.REQUEST, 2],
  ])('defines %s with value %i', (name, value, expected) => {
    expect(value).toBe(expected);
    expect(Scope[expected]).toBe(name);
  });

  it('exposes exactly three members', () => {
    const members = Object.keys(Scope).filter(key => Number.isNaN(Number(key)));
    expect(members).toEqual(['DEFAULT', 'TRANSIENT', 'REQUEST']);
  });

  it('supports reverse numeric lookup', () => {
    expect(Scope[Scope.DEFAULT]).toBe('DEFAULT');
    expect(Scope[Scope.TRANSIENT]).toBe('TRANSIENT');
    expect(Scope[Scope.REQUEST]).toBe('REQUEST');
    expect(Scope[3]).toBeUndefined();
  });
});
