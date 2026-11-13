/**
 * CFT planning inventory for packages/platform-express/multer/interceptors/no-files.interceptor.ts.
 * Decisions are numbered separately inside each function in source order.
 * xc1/xc2 identify atomic operands; &&/|| short-circuit before the next operand.
 * Loop and case guards count as decisions. Fallback operands are syntactic
 * planning entries, not independent boolean conditions. P=D+1 follows the
 * requested planning rule; these counts do not prove executable independent paths.
 * Cases exercise feasible T/F and error paths. V8 measures branch coverage,
 * not C3 or MC/DC directly. Nested callbacks have their own entries below.
 * NoFilesInterceptor @L28: syntactic D=0, planning P=D+1=1.
 * MixinInterceptor.constructor @L34: syntactic D=0, planning P=D+1=1.
 * MixinInterceptor.intercept @L44: syntactic D=0, planning P=D+1=1.
 * callback @L50: syntactic D=0, planning P=D+1=1.
 * callback @L51: syntactic D=1, planning P=D+1=2.
 *   if: 1=err
 */
import { describe, it } from 'vitest';
import { NoFilesInterceptor } from '../../../../../packages/platform-express/multer/interceptors/no-files.interceptor.js';
import { exerciseInterceptor } from '../interceptor-test.helper.js';

describe('NoFilesInterceptor', () => {
  describe('factory and MixinInterceptor constructor', () => {
    it.each([undefined, {}, { limits: { files: 3 } }])(
      'global options %j',
      options => {
        const Interceptor = NoFilesInterceptor({ limits: { fileSize: 1024 } });
        new (Interceptor as any)(options);
      },
    );
  });
  describe('MixinInterceptor.intercept and upload callback', () => {
    it.each(['nonmultipart', 'multipart', 'upload error', 'pipes rejected'])(
      'path %s',
      async mode => {
        await exerciseInterceptor(NoFilesInterceptor(), mode, 'none');
      },
    );
  });
});
