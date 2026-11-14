import { beforeEach, describe, expect, it } from 'vitest';
import { PIPES_METADATA } from '../../../../../packages/common/constants.js';
import { UsePipes } from '../../../../../packages/common/decorators/core/use-pipes.decorator.js';
import { InvalidDecoratorItemException } from '../../../../../packages/common/utils/validate-each.util.js';

class Target {
  handler() {}
}

beforeEach(() => {
  Reflect.deleteMetadata(PIPES_METADATA, Target);
});

describe('UsePipes', () => {
  it('xc1(T): registers a pipe class on a class target', () => {
    class Pipe {}

    UsePipes(Pipe)(Target);

    expect(Reflect.getMetadata(PIPES_METADATA, Target)).toEqual([Pipe]);
  });

  it('xc1(T): registers a pipe instance exposing transform()', () => {
    const pipe = { transform: () => undefined };

    UsePipes(pipe as any)(Target);

    expect(Reflect.getMetadata(PIPES_METADATA, Target)).toEqual([pipe]);
  });

  it('xc2(T): registers pipes on a method descriptor', () => {
    class Pipe {}
    const descriptor = { value: () => undefined };

    const result = UsePipes(Pipe)(Target.prototype, 'handler', descriptor);

    expect(result).toBe(descriptor);
    expect(Reflect.getMetadata(PIPES_METADATA, descriptor.value)).toEqual([
      Pipe,
    ]);
  });

  it('xc2(F): rejects a truthy value that is neither a function nor exposes transform()', () => {
    expect(() => UsePipes({} as any)(Target)).toThrow(
      InvalidDecoratorItemException,
    );
  });

  it('xc1(F): rejects a falsy pipe', () => {
    expect(() => UsePipes(null as any)(Target)).toThrow(
      InvalidDecoratorItemException,
    );
  });

  it('rejects an invalid pipe passed to a method', () => {
    expect(() =>
      UsePipes({} as any)(Target.prototype, 'handler', {
        value: () => undefined,
      }),
    ).toThrow(InvalidDecoratorItemException);
  });
});
