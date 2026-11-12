import { ROUTE_ARGS_METADATA } from '../../../../../packages/common/constants.js';
import {
  SSE_ABORT_CONTROLLER,
  SseSignal,
} from '../../../../../packages/common/decorators/http/sse-signal.decorator.js';

function registeredFactory(target: any, key: string) {
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, target, key);
  return Object.values(args)[0] as any;
}

function contextFor(request: any) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;
}

describe('SseSignal', () => {
  it('registers a route parameter whose factory returns the request abort signal', () => {
    class Target {
      method() {}
    }
    SseSignal()(Target.prototype, 'method', 0);

    const entry = registeredFactory(Target, 'method');
    const signal = { aborted: false };
    const request = { [SSE_ABORT_CONTROLLER]: { signal } };

    expect(entry.factory(undefined, contextFor(request))).toBe(signal);
  });

  it('returns undefined when the request has no abort controller', () => {
    class Target {
      method() {}
    }
    SseSignal()(Target.prototype, 'method', 0);
    const entry = registeredFactory(Target, 'method');

    expect(entry.factory(undefined, contextFor({}))).toBeUndefined();
    expect(entry.factory(undefined, contextFor(undefined))).toBeUndefined();
  });
});
