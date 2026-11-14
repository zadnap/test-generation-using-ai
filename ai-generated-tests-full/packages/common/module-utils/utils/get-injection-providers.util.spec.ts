import { describe, expect, it } from 'vitest';
import { getInjectionProviders } from '../../../../../packages/common/module-utils/utils/get-injection-providers.util.js';

const TOKEN = 'TOKEN';
const OTHER = 'OTHER';

describe('getInjectionProviders', () => {
  it('returns an empty list when no provider matches', () => {
    expect(getInjectionProviders([], [TOKEN])).toEqual([]);
  });

  it('finds a provider by its injection token', () => {
    const provider = { provide: TOKEN, useValue: 1 };
    expect(getInjectionProviders([provider], [TOKEN])).toEqual([provider]);
  });

  it('supports optional dependencies', () => {
    const provider = { provide: TOKEN, useValue: 1 };
    expect(
      getInjectionProviders(
        [provider],
        [{ token: TOKEN, optional: true } as any],
      ),
    ).toEqual([provider]);
  });

  it('follows existing-provider aliases', () => {
    const alias = { provide: TOKEN, useExisting: OTHER };
    const target = { provide: OTHER, useValue: 1 };
    expect(getInjectionProviders([alias, target], [TOKEN])).toEqual([
      alias,
      target,
    ]);
  });

  it('follows factory dependencies', () => {
    const factory = { provide: TOKEN, useFactory: () => 1, inject: [OTHER] };
    const dependency = { provide: OTHER, useValue: 1 };
    expect(getInjectionProviders([factory, dependency], [TOKEN])).toEqual([
      factory,
      dependency,
    ]);
  });

  it('does not add the same provider twice', () => {
    const provider = { provide: TOKEN, useValue: 1 };
    const result = getInjectionProviders([provider], [TOKEN, TOKEN]);
    expect(result).toEqual([provider]);
  });

  it('treats class tokens as providers themselves', () => {
    class Service {}
    expect(getInjectionProviders([Service as any], [Service as any])).toEqual([
      Service,
    ]);
  });

  it('treats an optional dependency only when both fields exist and it is not a class', () => {
    const provider = { provide: TOKEN, useValue: 1 };
    expect(
      getInjectionProviders([provider], [{ token: TOKEN } as any]),
    ).toEqual([]);
  });
});
