/**
 * CFT checklist extracted from packages/core/helpers/cookies/parse-cookie-header.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * parseCookieHeader @L20 - D=9, P=10.
 *   1=!header
 *   2=Array.isArray(header)
 *   3=next iteration of source.split(';')
 *   4=eqIndex === -1
 *   5c1=!name | 5c2=name in cookies
 *   6c1=value.length >= 2 | 6c2=value[0] === '"' | 6c3=value.endsWith('"')
 * trimWhitespace @L54 - D=4, P=5.
 *   1c1=start < end | 1c2=isWhitespace(input.charCodeAt(start))
 *   2c1=end > start | 2c2=isWhitespace(input.charCodeAt(end - 1))
 * isWhitespace @L66 - D=2, P=3.
 *   1c1=charCode === 0x20 | 1c2=charCode === 0x09
 * safeDecode @L70 - D=1, P=2.
 *   1=!value.includes('%')
 */
import { describe, it } from 'vitest';
import { parseCookieHeader } from '../../../../../packages/core/helpers/cookies/parse-cookie-header.js';

describe('parseCookieHeader and local whitespace/decoding helpers', () => {
  // Header absent/array/string. Each atomic quote check is evaluated T/F.
  // Name missing/duplicate, spaces/tabs, decode success and failure.
  it.each(
    [
      undefined,
      null,
      '',
      [],
      ['a=1', 'b=2'],
      'bare; =empty; a=first;a=second',
      'a=x; b="quoted"; c="unterminated; d=x"; e="; f=',
      ' \ta\t = \t%20\t ;b=%ZZ;c=plain;\t\t=ignored;\u00a0name=value',
      '__proto__=x;constructor=y;prototype=z',
      '   ;\t\t',
    ].map(header => ({ header })),
  )('header $header', ({ header }) => {
    parseCookieHeader(header);
  });
});
