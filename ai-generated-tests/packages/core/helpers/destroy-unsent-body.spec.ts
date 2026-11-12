/**
 * CFT checklist extracted from packages/core/helpers/destroy-unsent-body.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * destroyUnsentBody @L12 - D=3, P=4.
 *   1=isStreamingBody(value)
 *   2=!(value instanceof StreamableFile)
 *   3=isFunction(stream?.destroy)
 */
import { describe, it } from 'vitest';
import { StreamableFile } from '@nestjs/common';
import { Readable } from 'node:stream';
import { destroyUnsentBody } from '../../../../packages/core/helpers/destroy-unsent-body.js';

describe('destroyUnsentBody', () => {
  it('streaming body, ordinary value, StreamableFile and non-destroyable source', () => {
    destroyUnsentBody(Readable.from([]));
    destroyUnsentBody({});
    destroyUnsentBody(new StreamableFile(Buffer.from('value')));
    const file = new StreamableFile(Buffer.from('value'));
    file.getStream().destroy = undefined as any;
    destroyUnsentBody(file);
  });
});
