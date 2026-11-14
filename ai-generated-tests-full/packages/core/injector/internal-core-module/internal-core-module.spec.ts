import { describe, expect, it } from 'vitest';
import { MODULE_METADATA } from '../../../../../packages/common/constants.js';
import { InternalCoreModule } from '../../../../../packages/core/injector/internal-core-module/internal-core-module.js';

describe('InternalCoreModule', () => {
  it('declares the core providers and exports', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      InternalCoreModule,
    );
    const exports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      InternalCoreModule,
    );

    expect(providers).toHaveLength(4);
    expect(exports).toHaveLength(4);
  });

  it('registers dynamic providers and exports their tokens', () => {
    const first = { provide: 'first', useValue: 1 };
    const second = { provide: 'second', useFactory: () => 2 };

    const dynamicModule = InternalCoreModule.register([first, second] as any);

    expect(dynamicModule.module).toBe(InternalCoreModule);
    expect(dynamicModule.providers).toEqual([first, second]);
    expect(dynamicModule.exports).toEqual(['first', 'second']);
  });
});
