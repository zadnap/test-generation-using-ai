import { describe, expect, it } from 'vitest';
import { UnknownExportException } from '../../../../../packages/core/errors/exceptions/unknown-export.exception.js';

describe('UnknownExportException', () => {
  it('mentions the token and module', () => {
    const exception = new UnknownExportException('TOKEN', 'CatsModule');

    expect(exception.message).toContain('TOKEN');
    expect(exception.message).toContain('CatsModule');
  });
});
