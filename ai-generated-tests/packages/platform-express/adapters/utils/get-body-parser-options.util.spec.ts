/**
 * CFT planning inventory for packages/platform-express/adapters/utils/get-body-parser-options.util.ts.
 * Decisions are numbered separately inside each function in source order.
 * xc1/xc2 identify atomic operands; &&/|| short-circuit before the next operand.
 * Loop and case guards count as decisions. Fallback operands are syntactic
 * planning entries, not independent boolean conditions. P=D+1 follows the
 * requested planning rule; these counts do not prove executable independent paths.
 * Cases exercise feasible T/F and error paths. V8 measures branch coverage,
 * not C3 or MC/DC directly. Nested callbacks have their own entries below.
 * rawBodyParser @L9: syntactic D=1, planning P=D+1=2.
 *   if: 1=Buffer.isBuffer(buffer)
 * getBodyParserOptions @L20: syntactic D=3, planning P=D+1=4.
 *   if: 1=rawBody === true
 *   logical/fallback expression: 2c1=options | 2c2={}
 */
import { describe, it } from 'vitest';
import { getBodyParserOptions } from '../../../../../packages/platform-express/adapters/utils/get-body-parser-options.util.js';

describe('getBodyParserOptions', () => {
  it.each(['json', 'urlencoded', 'text', 'raw'] as const)(
    'parser %s with raw-body capture',
    parser => {
      const options: any = getBodyParserOptions(parser, true, { limit: '1kb' });
      options.verify({}, {}, Buffer.from('body'));
      options.verify({}, {}, new Uint8Array([1]));
      options.verify({}, {}, undefined);
    },
  );

  it.each([undefined, {}, { limit: '2kb' }])(
    'raw body disabled with options %j',
    options => {
      getBodyParserOptions('json', false, options);
    },
  );
});
