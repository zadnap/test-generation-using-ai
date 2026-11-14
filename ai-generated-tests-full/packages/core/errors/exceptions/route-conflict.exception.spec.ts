import { describe, expect, it } from 'vitest';
import { RouteConflictException } from '../../../../../packages/core/errors/exceptions/route-conflict.exception.js';

describe('RouteConflictException', () => {
  it('lists the conflicting routes', () => {
    const exception = new RouteConflictException(['GET /a', 'GET /b']);

    expect(exception.message).toContain('  - GET /a');
    expect(exception.message).toContain('  - GET /b');
  });
});
