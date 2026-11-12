/**
 * CFT checklist extracted from packages/core/router/sse-stream.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * serializeSseLines @L12 - D=0, P=1.
 * callback @L15 - D=0, P=1.
 * toDataString @L19 - D=1, P=2.
 *   1=isObject(data)
 * toCommentString @L27 - D=0, P=1.
 * omitHeaders @L31 - D=0, P=1.
 * callback @L35 - D=0, P=1.
 * callback @L38 - D=0, P=1.
 * formatMessage @L43 - D=5, P=6.
 *   1=message.type
 *   2=!isNil(message.id)
 *   3=!isNil(message.retry)
 *   4=!isNil(message.comment)
 *   5=!isNil(message.data)
 * sanitize @L44 - D=0, P=1.
 * isCommentOnly @L54 - D=4, P=5.
 *   1c1=!isNil(message.comment) | 1c2=isUndefined(message.data) | 1c3=isUndefined(message.type) | 1c4=isUndefined(message.retry)
 * SseStream.constructor @L114 - D=3, P=4.
 *   1c1=req | 1c2=req.socket | 1c3=!this._isHttp2
 * SseStream.headersCommitted @L130 - D=0, P=1.
 * SseStream.pipe @L134 - D=0, P=1.
 * SseStream.commitHeaders @L153 - D=6, P=7.
 *   1c1=this._headersCommitted | 1c2=!this._destination | 1c3=this._destination.writableEnded
 *   2=this._destination.writeHead
 *   3c1=!this._isHttp2 | 3c2={ Connection: 'keep-alive' }
 * SseStream.readStatusCode @L192 - D=1, P=2.
 *   1=isFunction(source)
 * SseStream.readAdditionalHeaders @L197 - D=1, P=2.
 *   1=isFunction(source)
 * SseStream._transform @L202 - D=1, P=2.
 *   1=isString(message)
 * SseStream.writeMessage @L216 - D=3, P=4.
 *   1c1=isNil(message.id) | 1c2=!isCommentOnly(message)
 *   2=!this.write(chunk, 'utf-8')
 */
import { afterEach, describe, it, vi } from 'vitest';
import { PassThrough } from 'node:stream';
import { SseStream } from '../../../../packages/core/router/sse-stream.js';
afterEach(() => vi.restoreAllMocks());
function response(): any {
  const value = new PassThrough();
  value.resume();
  return Object.assign(value, {
    writeHead: vi.fn(),
    flushHeaders: vi.fn(),
    statusCode: 201,
  });
}
describe('SseStream', () => {
  describe('constructor/pipe/headersCommitted/commitHeaders/readStatusCode/readAdditionalHeaders', () => {
    it.each([
      undefined,
      {
        httpVersionMajor: 1,
        socket: {
          setKeepAlive: vi.fn(),
          setNoDelay: vi.fn(),
          setTimeout: vi.fn(),
        },
      },
      { httpVersionMajor: 2, socket: {} },
      { socket: {} },
    ])('request %j', request => {
      const stream = new SseStream(request as any);
      stream.headersCommitted;
      stream.commitHeaders();
      const res = response();
      stream.pipe(res, {
        statusCode: () => 202,
        additionalHeaders: () => ({
          'content-type': 'override',
          'x-fixture': 'value',
        }),
      });
      stream.commitHeaders();
      stream.commitHeaders();
      stream.end();
    });
    it('no writeHead and ended destination', () => {
      const first = new SseStream();
      const res = response();
      res.writeHead = undefined;
      first.pipe(res, { statusCode: 201, additionalHeaders: {} });
      first.commitHeaders();
      first.end();
      const second = new SseStream();
      const ended = response();
      ended.end();
      second.pipe(ended);
      second.commitHeaders();
      second.destroy();
    });
  });
  describe('_transform/formatMessage/serializeSseLines/toDataString/toCommentString', () => {
    it.each([
      'raw',
      {},
      {
        type: 'event\r\n',
        id: 'id\r\n',
        retry: 0,
        comment: 'a\nb',
        data: 'a\r\nb\rc',
      },
      { data: { nested: true } },
    ])('message %j', message => {
      const stream = new SseStream();
      stream.resume();
      stream.write(message);
      stream.end();
    });
  });
  describe('writeMessage/isCommentOnly', () => {
    it.each([
      { comment: 'keepalive' },
      { comment: 'c', data: 'data' },
      { comment: 'c', type: 'type' },
      { comment: 'c', retry: 1 },
      { data: 'value' },
      { id: 'explicit', data: 'value' },
    ])('event %j', async message => {
      const stream = new SseStream();
      stream.resume();
      await new Promise<void>(resolve =>
        stream.writeMessage(message, () => resolve()),
      );
      stream.end();
    });
    it('serialization error and backpressure', async () => {
      const stream = new SseStream();
      stream.resume();
      const circular: any = {};
      circular.self = circular;
      await new Promise<void>(resolve =>
        stream.writeMessage({ data: circular }, () => resolve()),
      );
      vi.spyOn(stream, 'write').mockReturnValue(false);
      const done = new Promise<void>(resolve =>
        stream.writeMessage({ data: 'value' }, () => resolve()),
      );
      stream.emit('drain');
      await done;
      stream.destroy();
    });
  });
});
