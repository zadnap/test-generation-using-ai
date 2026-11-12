import {
  CONTROLLER_WATERMARK,
  HOST_METADATA,
  PATH_METADATA,
  SCOPE_OPTIONS_METADATA,
  VERSION_METADATA,
} from '../../../../../packages/common/constants.js';
import { Controller } from '../../../../../packages/common/decorators/core/controller.decorator.js';

describe('Controller', () => {
  it('uses defaults when no argument is provided', () => {
    class Target {}
    Controller()(Target);

    expect(Reflect.getMetadata(CONTROLLER_WATERMARK, Target)).toBe(true);
    expect(Reflect.getMetadata(PATH_METADATA, Target)).toBe('/');
    expect(Reflect.getMetadata(HOST_METADATA, Target)).toBeUndefined();
    expect(
      Reflect.getMetadata(SCOPE_OPTIONS_METADATA, Target),
    ).toBeUndefined();
    expect(Reflect.getMetadata(VERSION_METADATA, Target)).toBeUndefined();
  });

  it('accepts a string or array path directly', () => {
    class StringPath {}
    class ArrayPath {}
    Controller('users')(StringPath);
    Controller(['users', 'people'])(ArrayPath);

    expect(Reflect.getMetadata(PATH_METADATA, StringPath)).toBe('users');
    expect(Reflect.getMetadata(PATH_METADATA, ArrayPath)).toEqual([
      'users',
      'people',
    ]);
    expect(Reflect.getMetadata(HOST_METADATA, StringPath)).toBeUndefined();
    expect(Reflect.getMetadata(VERSION_METADATA, StringPath)).toBeUndefined();
  });

  it('reads options, falls back for an empty path, and keeps scalar version', () => {
    class Target {}
    Controller({
      path: '',
      host: 'api.example.com',
      scope: 'request' as any,
      durable: true,
      version: '1',
    })(Target);

    expect(Reflect.getMetadata(PATH_METADATA, Target)).toBe('/');
    expect(Reflect.getMetadata(HOST_METADATA, Target)).toBe(
      'api.example.com',
    );
    expect(Reflect.getMetadata(SCOPE_OPTIONS_METADATA, Target)).toEqual({
      scope: 'request',
      durable: true,
    });
    expect(Reflect.getMetadata(VERSION_METADATA, Target)).toBe('1');
  });

  it('deduplicates array versions and preserves the supplied path', () => {
    class Target {}
    Controller({ path: 'v1', version: ['1', '2', '1', '2'] })(Target);

    expect(Reflect.getMetadata(PATH_METADATA, Target)).toBe('v1');
    expect(Reflect.getMetadata(VERSION_METADATA, Target)).toEqual(['1', '2']);
    expect(Reflect.getMetadata(HOST_METADATA, Target)).toBeUndefined();
  });
});
