/**
 * CFT planning inventory for packages/platform-express/multer/multer.module.ts.
 * Decisions are numbered separately inside each function in source order.
 * xc1/xc2 identify atomic operands; &&/|| short-circuit before the next operand.
 * Loop and case guards count as decisions. Fallback operands are syntactic
 * planning entries, not independent boolean conditions. P=D+1 follows the
 * requested planning rule; these counts do not prove executable independent paths.
 * Cases exercise feasible T/F and error paths. V8 measures branch coverage,
 * not C3 or MC/DC directly. Nested callbacks have their own entries below.
 * MulterModule.register @L16: syntactic D=0, planning P=D+1=1.
 * callback @L20: syntactic D=0, planning P=D+1=1.
 * MulterModule.registerAsync @L30: syntactic D=0, planning P=D+1=1.
 * MulterModule.createAsyncProviders @L45: syntactic D=2, planning P=D+1=3.
 *   if: 1c1=options.useExisting | 1c2=options.useFactory
 * MulterModule.createAsyncOptionsProvider @L60: syntactic D=5, planning P=D+1=6.
 *   if: 1=options.useFactory
 *   logical/fallback expression: 2c1=options.inject | 2c2=[]
 *   logical/fallback expression: 3c1=options.useExisting | 3c2=options.useClass!
 * callback @L72: syntactic D=0, planning P=D+1=1.
 */
import { describe, it } from 'vitest';
import { MulterModule } from '../../../../packages/platform-express/multer/multer.module.js';

describe('MulterModule', () => {
  describe('register', () => {
    it.each([undefined, {}, { limits: { files: 1 } }])(
      'options %j',
      options => {
        const module = MulterModule.register(options);
        for (const provider of module.providers as any[])
          provider.useFactory?.();
      },
    );
  });

  describe('registerAsync/createAsyncProviders/createAsyncOptionsProvider', () => {
    it.each(['factory', 'factory with injection', 'existing', 'class'])(
      'provider form %s',
      async mode => {
        class OptionsFactory {
          createMulterOptions() {
            return { limits: { files: 2 } };
          }
        }
        const options: any = mode.startsWith('factory')
          ? {
              useFactory: (...args: unknown[]) => ({
                preservePath: !!args.length,
              }),
              ...(mode === 'factory with injection'
                ? { inject: ['fixture'] }
                : {}),
            }
          : mode === 'existing'
            ? { useExisting: OptionsFactory }
            : { useClass: OptionsFactory };
        const module = MulterModule.registerAsync(options);
        for (const provider of module.providers as any[]) {
          if (provider.useFactory)
            await provider.useFactory(new OptionsFactory());
        }
      },
    );
  });
});
