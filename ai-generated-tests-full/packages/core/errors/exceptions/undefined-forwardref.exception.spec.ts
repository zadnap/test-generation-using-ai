import { describe, expect, it } from 'vitest';
import { UndefinedForwardRefException } from '../../../../../packages/core/errors/exceptions/undefined-forwardref.exception.js';

class Foo {}

describe('UndefinedForwardRefException', () => {
  it('lists the dependency scope', () => {
    const exception = new UndefinedForwardRefException([Foo]);

    expect(exception.message).toContain('Scope [Foo]');
  });
});
