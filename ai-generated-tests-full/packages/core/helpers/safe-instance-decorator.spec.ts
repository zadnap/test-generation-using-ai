import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '../../../../packages/common/services/logger.service.js';
import { makeSafeInstanceDecorator } from '../../../../packages/core/helpers/safe-instance-decorator.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('makeSafeInstanceDecorator', () => {
  it('returns the decorated instance when the decorator succeeds', () => {
    const decorator = vi.fn(() => 'decorated');
    const safe = makeSafeInstanceDecorator(decorator);

    expect(safe('instance')).toBe('decorated');
    expect(decorator).toHaveBeenCalledWith('instance');
  });

  it('returns the original instance and logs a warning when the decorator throws', () => {
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const decorator = vi.fn(() => {
      throw new Error('boom');
    });
    const safe = makeSafeInstanceDecorator(decorator);

    expect(safe('instance')).toBe('instance');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('boom'));
  });

  it('logs non-error thrown values', () => {
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const decorator = vi.fn(() => {
      throw 'failure';
    });
    const safe = makeSafeInstanceDecorator(decorator);

    safe('instance');

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('failure'));
  });
});
