/**
 * CFT planning inventory for packages/platform-express/multer/interceptors/file-fields.interceptor.ts.
 * Decisions are numbered separately inside each function in source order.
 * xc1/xc2 identify atomic operands; &&/|| short-circuit before the next operand.
 * Loop and case guards count as decisions. Fallback operands are syntactic
 * planning entries, not independent boolean conditions. P=D+1 follows the
 * requested planning rule; these counts do not prove executable independent paths.
 * Cases exercise feasible T/F and error paths. V8 measures branch coverage,
 * not C3 or MC/DC directly. Nested callbacks have their own entries below.
 * FileFieldsInterceptor @L32: syntactic D=0, planning P=D+1=1.
 * MixinInterceptor.constructor @L39: syntactic D=0, planning P=D+1=1.
 * MixinInterceptor.intercept @L49: syntactic D=0, planning P=D+1=1.
 * callback @L55: syntactic D=0, planning P=D+1=1.
 * callback @L59: syntactic D=1, planning P=D+1=2.
 *   if: 1=err
 */
import { describe, it } from 'vitest';
import { FileFieldsInterceptor } from '../../../../../packages/platform-express/multer/interceptors/file-fields.interceptor.js';
import { exerciseInterceptor } from '../interceptor-test.helper.js';

describe('FileFieldsInterceptor', () => {
  describe('factory and MixinInterceptor constructor', () => {
    it.each([undefined, {}, { limits: { files: 3 } }])(
      'global options %j',
      options => {
        const Interceptor = FileFieldsInterceptor(
          [{ name: 'upload', maxCount: 2 }],
          { limits: { fileSize: 1024 } },
        );
        new (Interceptor as any)(options);
      },
    );
  });
  describe('MixinInterceptor.intercept and upload callback', () => {
    it.each(['nonmultipart', 'multipart', 'upload error', 'pipes rejected'])(
      'path %s',
      async mode => {
        await exerciseInterceptor(
          FileFieldsInterceptor([{ name: 'upload', maxCount: 2 }]),
          mode,
          'fields',
        );
      },
    );
  });
});
