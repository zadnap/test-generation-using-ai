import { describe, expect, it } from 'vitest';
import { UndefinedModuleEntryException } from '../../../../../packages/core/errors/exceptions/undefined-module-entry.exception.js';

describe('UndefinedModuleEntryException', () => {
  it('formats a missing provider entry', () => {
    const exception = new UndefinedModuleEntryException(
      class Parent {},
      'providers',
      0,
    );

    expect(exception.message).toContain('The provider at index [0]');
  });

  it('formats a missing controller entry', () => {
    const exception = new UndefinedModuleEntryException(
      class Parent {},
      'controllers',
      1,
    );

    expect(exception.message).toContain('The controller at index [1]');
  });

  it('formats a missing export entry', () => {
    const exception = new UndefinedModuleEntryException(
      class Parent {},
      'exports',
      2,
    );

    expect(exception.message).toContain('The export at index [2]');
  });
});
