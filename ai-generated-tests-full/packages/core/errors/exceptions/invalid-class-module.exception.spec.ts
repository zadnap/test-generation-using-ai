import { describe, expect, it } from 'vitest';
import { InvalidClassModuleException } from '../../../../../packages/core/errors/exceptions/invalid-class-module.exception.js';

class Foo {}

describe('InvalidClassModuleException', () => {
  it('xc1(T): explains controllers used as modules', () => {
    const exception = new InvalidClassModuleException(Foo, [Foo], 'controller');

    expect(exception.message).toContain('@Controller()');
    expect(exception.message).toContain('"Foo"');
  });

  it('xc1(F), xc2(T): explains providers used as modules', () => {
    const exception = new InvalidClassModuleException(Foo, [], 'provider');

    expect(exception.message).toContain('@Injectable()');
  });

  it('xc2(F): explains filters used as modules', () => {
    const exception = new InvalidClassModuleException(Foo, [], 'filter');

    expect(exception.message).toContain('@Catch()');
  });
});
