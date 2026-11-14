import { describe, expect, it } from 'vitest';
import { ROUTE_ARGS_METADATA } from '../../../../../packages/common/constants.js';
import {
  SSE_ABORT_CONTROLLER,
  SseSignal,
} from '../../../../../packages/common/decorators/http/sse-signal.decorator.js';

function getFactory() {
  class Target {
    handler() {}
  }
  SseSignal()(Target.prototype, 'handler', 0);
  const metadata = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    Target,
    'handler',
  );
  return (Object.values(metadata)[0] as any).factory;
}

function contextFor(request: unknown) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as any;
}

describe('SseSignal', () => {
  it('xc1(T): returns the signal of the request abort controller', () => {
    const controller = new AbortController();
    const factory = getFactory();

    const signal = factory(undefined, contextFor({
      [SSE_ABORT_CONTROLLER]: controller,
    }));

    expect(signal).toBe(controller.signal);
  });

  it('xc1(F): returns undefined when the request has no abort controller', () => {
    const factory = getFactory();

    expect(factory(undefined, contextFor({}))).toBeUndefined();
  });

  it('returns undefined when the request itself is missing', () => {
    const factory = getFactory();

    expect(factory(undefined, contextFor(undefined))).toBeUndefined();
  });
});
