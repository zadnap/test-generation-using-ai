import { describe, expect, it } from 'vitest';
import {
  CONTROLLER_WATERMARK,
  HOST_METADATA,
  PATH_METADATA,
  SCOPE_OPTIONS_METADATA,
  VERSION_METADATA,
} from '../../../../../packages/common/constants.js';
import { Controller } from '../../../../../packages/common/decorators/core/controller.decorator.js';
import { Scope } from '../../../../../packages/common/interfaces/scope-options.interface.js';

function apply(decorator: ClassDecorator) {
  class Target {}
  decorator(Target);
  return Target;
}

describe('Controller', () => {
  it('xc1(T), xc2(T): uses default path and empty options when called without arguments', () => {
    const Target = apply(Controller());

    expect(Reflect.getMetadata(CONTROLLER_WATERMARK, Target)).toBe(true);
    expect(Reflect.getMetadata(PATH_METADATA, Target)).toBe('/');
    expect(Reflect.getMetadata(HOST_METADATA, Target)).toBeUndefined();
    expect(Reflect.getMetadata(SCOPE_OPTIONS_METADATA, Target)).toBeUndefined();
    expect(Reflect.getMetadata(VERSION_METADATA, Target)).toBeUndefined();
  });

  it('xc1(F), xc2(T): accepts a string prefix', () => {
    const Target = apply(Controller('cats'));

    expect(Reflect.getMetadata(PATH_METADATA, Target)).toBe('cats');
    expect(Reflect.getMetadata(HOST_METADATA, Target)).toBeUndefined();
  });

  it('xc1(F), xc2(F): accepts an array prefix', () => {
    const Target = apply(Controller(['cats', 'dogs']));

    expect(Reflect.getMetadata(PATH_METADATA, Target)).toEqual([
      'cats',
      'dogs',
    ]);
  });

  it('xc3(T): uses the path from the options object', () => {
    const Target = apply(
      Controller({ path: 'v1', host: 'example.com', version: '1' }),
    );

    expect(Reflect.getMetadata(PATH_METADATA, Target)).toBe('v1');
    expect(Reflect.getMetadata(HOST_METADATA, Target)).toBe('example.com');
    expect(Reflect.getMetadata(VERSION_METADATA, Target)).toBe('1');
  });

  it('xc3(F): falls back to the default path when options.path is missing', () => {
    const Target = apply(Controller({ host: 'example.com' }));

    expect(Reflect.getMetadata(PATH_METADATA, Target)).toBe('/');
  });

  it('stores scope options and deduplicates an array version', () => {
    const Target = apply(
      Controller({
        scope: Scope.REQUEST,
        durable: true,
        version: ['1', '1', '2'],
      }),
    );

    expect(Reflect.getMetadata(SCOPE_OPTIONS_METADATA, Target)).toEqual({
      scope: Scope.REQUEST,
      durable: true,
    });
    expect(Reflect.getMetadata(VERSION_METADATA, Target)).toEqual(['1', '2']);
  });

  it('xc4(F): keeps a non-array version untouched', () => {
    const version = Symbol('v');
    const Target = apply(Controller({ version }));

    expect(Reflect.getMetadata(VERSION_METADATA, Target)).toBe(version);
  });
});
