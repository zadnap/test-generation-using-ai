import { describe, expect, it } from 'vitest';
import { InternalProvidersStorage } from '../../../../packages/core/injector/internal-providers-storage.js';

describe('InternalProvidersStorage', () => {
  it('exposes a http adapter host', () => {
    const storage = new InternalProvidersStorage();

    expect(storage.httpAdapterHost).toBeDefined();
    expect(storage.httpAdapterHost).toBe(storage.httpAdapterHost);
  });

  it('returns undefined before an adapter is set', () => {
    const storage = new InternalProvidersStorage();

    expect(storage.httpAdapter).toBeUndefined();
  });

  it('stores the http adapter', () => {
    const storage = new InternalProvidersStorage();
    const adapter = { get: () => 'x' } as any;

    storage.httpAdapter = adapter;

    expect(storage.httpAdapter).toBe(adapter);
  });
});
