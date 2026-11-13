/**
 * CFT planning inventory for packages/platform-express/adapters/utils/get-media-type-version.util.ts.
 * Decisions are numbered separately inside each function in source order.
 * xc1/xc2 identify atomic operands; &&/|| short-circuit before the next operand.
 * Loop and case guards count as decisions. Fallback operands are syntactic
 * planning entries, not independent boolean conditions. P=D+1 follows the
 * requested planning rule; these counts do not prove executable independent paths.
 * Cases exercise feasible T/F and error paths. V8 measures branch coverage,
 * not C3 or MC/DC directly. Nested callbacks have their own entries below.
 * splitOutsideQuotes @L5: syntactic D=6, planning P=D+1=7.
 *   loop: 1=index < len
 *   if: 2c1=isQuoted | 2c2=character === '\\'
 *   if: 3=character === '"'
 *   if: 4c1=character === separator | 4c2=!isQuoted
 * getMediaTypeVersion @L41: syntactic D=7, planning P=D+1=8.
 *   logical/fallback expression: 1c1=acceptHeader | 1c2=[]
 *   loop: 2=next iteration
 *   loop: 3=next iteration
 *   if: 4=trimmedParameter.startsWith(key)
 *   if: 5c1=version.startsWith('"') | 5c2=version.endsWith('"')
 * callback @L47: syntactic D=0, planning P=D+1=1.
 */
import { describe, it } from 'vitest';
import { getMediaTypeVersion } from '../../../../../packages/platform-express/adapters/utils/get-media-type-version.util.js';

describe('getMediaTypeVersion and splitOutsideQuotes', () => {
  it.each(
    [
      undefined,
      null,
      '',
      [],
      'text/plain',
      'application/json;charset=utf8',
      'application/json;v=1',
      'text/html, application/json;v=2',
      'application/json;v=1, application/json;v=2',
      'application/json;v=',
      'application/json; v="2"',
      'application/json;v="unterminated',
      'application/json;note="a,b;c";v=3',
      'application/json;v="a\\"b"',
      'application/json;v="a\\\\b"',
      'application/json;note="unterminated;v=2',
      'application/json;note="trailing\\',
      'application/json;v=a\\"b',
      ['text/plain', 'application/json;v=4'],
      ['text/plain', 'text/html'],
    ].map(header => ({ header })),
  )('header $header', ({ header }) => {
    getMediaTypeVersion(header as any, 'v=');
  });

  it.each(['version=', '', 'missing='])('custom key %s', key => {
    getMediaTypeVersion('application/json;version="3";v=2', key);
  });
});
