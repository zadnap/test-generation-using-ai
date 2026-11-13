/**
 * CFT planning inventory for packages/platform-express/multer/interceptors/files.interceptor.ts.
 * Decisions are numbered separately inside each function in source order.
 * xc1/xc2 identify atomic operands; &&/|| short-circuit before the next operand.
 * Loop and case guards count as decisions. Fallback operands are syntactic
 * planning entries, not independent boolean conditions. P=D+1 follows the
 * requested planning rule; these counts do not prove executable independent paths.
 * Cases exercise feasible T/F and error paths. V8 measures branch coverage,
 * not C3 or MC/DC directly. Nested callbacks have their own entries below.
 * FilesInterceptor @L32: syntactic D=0, planning P=D+1=1.
 * MixinInterceptor.constructor @L40: syntactic D=0, planning P=D+1=1.
 * MixinInterceptor.intercept @L50: syntactic D=0, planning P=D+1=1.
 * callback @L56: syntactic D=0, planning P=D+1=1.
 * callback @L60: syntactic D=1, planning P=D+1=2.
 *   if: 1=err
 */
import { describe, it } from 'vitest';
import { FilesInterceptor } from '../../../../../packages/platform-express/multer/interceptors/files.interceptor.js';
import { exerciseInterceptor } from '../interceptor-test.helper.js';

describe('FilesInterceptor', () => {
  describe('factory and MixinInterceptor constructor', () => {
    it.each([undefined, {}, { limits: { files: 3 } }])(
      'global options %j',
      options => {
        const Interceptor = FilesInterceptor('upload', 2, {
          limits: { fileSize: 1024 },
        });
        new (Interceptor as any)(options);
      },
    );
  });
  describe('MixinInterceptor.intercept and upload callback', () => {
    it.each(['nonmultipart', 'multipart', 'upload error', 'pipes rejected'])(
      'path %s',
      async mode => {
        await exerciseInterceptor(FilesInterceptor('upload', 2), mode, 'array');
      },
    );
  });
});
