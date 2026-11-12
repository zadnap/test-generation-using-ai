import {
  METHOD_METADATA,
  PATH_METADATA,
  SSE_METADATA,
  SSE_OPTIONS_METADATA,
} from '../../../../../packages/common/constants.js';
import { Sse } from '../../../../../packages/common/decorators/http/sse.decorator.js';
import { RequestMethod } from '../../../../../packages/common/enums/request-method.enum.js';

describe('Sse', () => {
  it('uses GET, the root path, and empty options by default', () => {
    class Target {
      method() {}
    }
    const descriptor = Object.getOwnPropertyDescriptor(
      Target.prototype,
      'method',
    )!;

    expect(Sse()(Target.prototype, 'method', descriptor)).toBe(descriptor);
    expect(Reflect.getMetadata(PATH_METADATA, descriptor.value)).toBe('/');
    expect(Reflect.getMetadata(METHOD_METADATA, descriptor.value)).toBe(
      RequestMethod.GET,
    );
    expect(Reflect.getMetadata(SSE_METADATA, descriptor.value)).toBe(true);
    expect(Reflect.getMetadata(SSE_OPTIONS_METADATA, descriptor.value)).toEqual(
      { maxPendingDataLength: undefined },
    );
  });

  it('respects an explicit path, method, and pending-data limit', () => {
    class Target {
      method() {}
    }
    const descriptor = Object.getOwnPropertyDescriptor(
      Target.prototype,
      'method',
    )!;

    Sse('events', {
      method: RequestMethod.POST,
      maxPendingDataLength: 1024,
    })(Target.prototype, 'method', descriptor);

    expect(Reflect.getMetadata(PATH_METADATA, descriptor.value)).toBe(
      'events',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, descriptor.value)).toBe(
      RequestMethod.POST,
    );
    expect(Reflect.getMetadata(SSE_OPTIONS_METADATA, descriptor.value)).toEqual(
      { maxPendingDataLength: 1024 },
    );
  });

  it('uses the root path for an empty path string', () => {
    class Target {
      method() {}
    }
    const descriptor = Object.getOwnPropertyDescriptor(
      Target.prototype,
      'method',
    )!;

    Sse('')(Target.prototype, 'method', descriptor);

    expect(Reflect.getMetadata(PATH_METADATA, descriptor.value)).toBe('/');
  });
});
