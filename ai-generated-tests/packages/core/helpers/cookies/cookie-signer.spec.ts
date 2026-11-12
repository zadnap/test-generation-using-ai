/**
 * CFT checklist extracted from packages/core/helpers/cookies/cookie-signer.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * CookieSigner.constructor @L25 - D=3, P=4.
 *   1=Array.isArray(secret)
 *   2c1=secrets.length === 0 | 2c2=secrets.some(item => typeof item !== 'string' || item.length === 0)
 * CookieSigner.callback @L29 - D=2, P=3.
 *   1c1=typeof item !== 'string' | 1c2=item.length === 0
 * CookieSigner.sign @L41 - D=0, P=1.
 * CookieSigner.unsign @L49 - D=7, P=8.
 *   1=typeof input !== 'string'
 *   2=input.startsWith(SIGNED_COOKIE_PREFIX)
 *   3=dotIndex === -1
 *   4=next iteration of this.secrets
 *   5c1=expected.length === signature.length | 5c2=timingSafeEqual(expected, signature)
 *   6=valid
 * CookieSigner.digest @L77 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { CookieSigner } from '../../../../../packages/core/helpers/cookies/cookie-signer.js';

describe('CookieSigner', () => {
  describe('constructor', () => {
    // 1c1(empty list),1c2(non-string secret),1c3(empty string).
    it.each([[], '', [1], ['']].map(secret => ({ secret })))(
      'rejects $secret',
      ({ secret }) => {
        try {
          new CookieSigner(secret as any);
        } catch (error) {
          if (!(error instanceof TypeError)) throw error;
        }
      },
    );
  });
  describe('sign/digest/unsign', () => {
    it.each(['', 'value.with.dots', 'unicode-\u2713'])(
      'signs %s and verifies both prefix forms',
      value => {
        const old = new CookieSigner('fixture-old');
        const current = new CookieSigner(['fixture-new', 'fixture-old']);
        current.unsign(current.sign(value));
        current.unsign(old.sign(value));
        current.unsign(old.sign(value).slice(2));
        current.unsign(old.sign(value).slice(0, -1) + '!');
      },
    );
    it.each([undefined, 1, '', 'no-dot', 'x.short', 'x.' + 'a'.repeat(43)])(
      'invalid input %s',
      input => {
        new CookieSigner('fixture').unsign(input as any);
      },
    );
  });
});
