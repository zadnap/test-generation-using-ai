import { describe, expect, it, vi } from 'vitest';
import { HttpAdapterHost } from '../../../../packages/core/helpers/http-adapter-host.js';

describe('HttpAdapterHost', () => {
  it('stores and returns the http adapter', () => {
    const host = new HttpAdapterHost();
    const adapter = { name: 'adapter' } as any;

    host.httpAdapter = adapter;

    expect(host.httpAdapter).toBe(adapter);
  });

  it('xc1(T): emits and completes the init observable when the adapter is set', () => {
    const host = new HttpAdapterHost();
    const onInit = vi.fn();
    const onComplete = vi.fn();
    host.init$.subscribe({ next: onInit, complete: onComplete });

    host.httpAdapter = {} as any;

    expect(onInit).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('xc1(T): emits and completes the listen observable when listening starts', () => {
    const host = new HttpAdapterHost();
    const onListen = vi.fn();
    const onComplete = vi.fn();
    host.listen$.subscribe({ next: onListen, complete: onComplete });

    host.listening = true;

    expect(host.listening).toBe(true);
    expect(onListen).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('xc1(F): only updates the flag when listening stops', () => {
    const host = new HttpAdapterHost();
    const onListen = vi.fn();
    host.listen$.subscribe(onListen);

    host.listening = false;

    expect(host.listening).toBe(false);
    expect(onListen).not.toHaveBeenCalled();
  });
});
