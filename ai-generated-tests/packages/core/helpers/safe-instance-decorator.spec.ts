/**
 * CFT checklist extracted from packages/core/helpers/safe-instance-decorator.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * makeSafeInstanceDecorator @L14 - D=0, P=1.
 * callback @L17 - D=0, P=1.
 */
import { afterEach, describe, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { makeSafeInstanceDecorator } from '../../../../packages/core/helpers/safe-instance-decorator.js';
afterEach(() => vi.restoreAllMocks());
describe('makeSafeInstanceDecorator', () => {
  it('successful decoration', () => {
    makeSafeInstanceDecorator(value => value)({});
  });
  it.each([new Error('fixture'), 'fixture', null])(
    'throw %s, message/fallback paths',
    value => {
      vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      makeSafeInstanceDecorator(() => {
        throw value;
      })({});
    },
  );
});
