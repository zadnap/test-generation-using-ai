import { describe, expect, it } from 'vitest';
import {
  METHOD_METADATA,
  PATH_METADATA,
  SSE_METADATA,
  SSE_OPTIONS_METADATA,
} from '../../../../../packages/common/constants.js';
import { Sse } from '../../../../../packages/common/decorators/http/sse.decorator.js';
import { RequestMethod } from '../../../../../packages/common/enums/request-method.enum.js';

function apply(decorator: MethodDecorator) {
  const descriptor = { value: () => undefined };
  const result = decorator({}, 'handler', descriptor);
  return { descriptor, result };
}

describe('Sse', () => {
  it('xc1(F), xc2(F): uses the default path, GET method and empty options', () => {
    const { descriptor, result } = apply(Sse());

    expect(result).toBe(descriptor);
    expect(Reflect.getMetadata(PATH_METADATA, descriptor.value)).toBe('/');
    expect(Reflect.getMetadata(METHOD_METADATA, descriptor.value)).toBe(
      RequestMethod.GET,
    );
    expect(Reflect.getMetadata(SSE_METADATA, descriptor.value)).toBe(true);
    expect(
      Reflect.getMetadata(SSE_OPTIONS_METADATA, descriptor.value),
    ).toEqual({ maxPendingDataLength: undefined });
  });

  it('xc1(T): keeps a non-empty path', () => {
    const { descriptor } = apply(Sse('logs'));

    expect(Reflect.getMetadata(PATH_METADATA, descriptor.value)).toBe('logs');
  });

  it('xc1(T): falls back to "/" for an empty path', () => {
    const { descriptor } = apply(Sse(''));

    expect(Reflect.getMetadata(PATH_METADATA, descriptor.value)).toBe('/');
  });

  it('xc2(T): honours a custom method and pending-data limit', () => {
    const { descriptor } = apply(
      Sse('logs', { method: RequestMethod.POST, maxPendingDataLength: 10 }),
    );

    expect(Reflect.getMetadata(METHOD_METADATA, descriptor.value)).toBe(
      RequestMethod.POST,
    );
    expect(
      Reflect.getMetadata(SSE_OPTIONS_METADATA, descriptor.value),
    ).toEqual({ maxPendingDataLength: 10 });
  });
});
