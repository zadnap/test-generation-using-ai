import { describe, expect, it } from 'vitest';
import { RequestScopedCreateException } from '../../../../../packages/core/errors/exceptions/request-scoped-create.exception.js';

describe('RequestScopedCreateException', () => {
  it('mentions the provider name', () => {
    expect(new RequestScopedCreateException('Foo').message).toContain(
      'Foo depends on a request-scoped provider',
    );
  });
});
