/**
 * CFT checklist extracted from packages/core/router/streaming-body.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * isWebResponse @L34 - D=0, P=1.
 * isStreamingBody @L42 - D=4, P=5.
 *   1c1=isObject(value) | 1c2=isFunction(value[Symbol.asyncIterator]) | 1c3=!isFunction(value['then']) | 1c4=isWebResponse(value)
 * getSource @L50 - D=1, P=2.
 *   1=isWebResponse(body)
 * isStreamingBodyConsumed @L59 - D=4, P=5.
 *   1c1=!isNil(source) | 1c2=(source as ReadableStream).locked === true | 1c3=Readable.isDisturbed(source as Readable) | 1c4=!(source as Readable).errored
 * openStreamingBody @L74 - D=1, P=2.
 *   1=isFunction((source as ReadableStream).getReader)
 * callback @L77 - D=0, P=1.
 * callback @L77 - D=0, P=1.
 * callback @L81 - D=0, P=1.
 * callback @L82 - D=0, P=1.
 * cancelStreamingBody @L93 - D=2, P=3.
 *   1c1=isNil(source) | 1c2=(source as ReadableStream).locked
 * toResponseChunk @L109 - D=4, P=5.
 *   1=isString(value)
 *   2=ArrayBuffer.isView(value)
 *   3=types.isAnyArrayBuffer(value)
 *   4=json === undefined
 * inferContentType @L123 - D=3, P=4.
 *   1=isString(value)
 *   2c1=ArrayBuffer.isView(value) | 2c2=types.isAnyArrayBuffer(value)
 * getWebResponseHeaders @L138 - D=2, P=3.
 *   1c1=isFetched | 1c2=response.headers.has('content-encoding')
 * callback @L142 - D=7, P=8.
 *   1c1=name === 'set-cookie' | 1c2=isFetched | 1c3=HOP_BY_HOP_HEADERS.has(name) | 1c4=isDecoded | 1c5=name === 'content-encoding' | 1c6=name === 'content-length'
 *   2=!isDropped
 * toReadable @L159 - D=0, P=1.
 * [Symbol.asyncIterator] @L169 - D=0, P=1.
 * callback @L172 - D=2, P=3.
 *   1=pendingChunk !== undefined
 *   2=result.done
 * callback @L183 - D=0, P=1.
 * callback @L184 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import { Readable } from 'node:stream';
import {
  isWebResponse,
  isStreamingBody,
  isStreamingBodyConsumed,
  openStreamingBody,
  cancelStreamingBody,
  toResponseChunk,
  inferContentType,
  getWebResponseHeaders,
  toReadable,
} from '../../../../packages/core/router/streaming-body.js';

async function* producer() {
  yield 'one';
  yield { two: 2 };
}
describe('streaming-body helpers', () => {
  describe('isWebResponse/isStreamingBody', () => {
    it.each([
      null,
      1,
      {},
      [],
      new Response(null),
      producer(),
      { [Symbol.asyncIterator]: () => producer(), then: () => undefined },
    ])('value %s', value => {
      isWebResponse(value);
      isStreamingBody(value);
    });
  });
  describe('isStreamingBodyConsumed', () => {
    it('null body, unlocked/locked, disturbed and errored sources', async () => {
      isStreamingBodyConsumed(new Response(null));
      const web = new ReadableStream({
        start(controller) {
          controller.close();
        },
      });
      isStreamingBodyConsumed(web);
      const reader = web.getReader();
      isStreamingBodyConsumed(web);
      reader.releaseLock();
      const source = Readable.from(['one']);
      await source[Symbol.asyncIterator]().next();
      isStreamingBodyConsumed(source);
      source.destroy();
      const failed = new Readable({ read() {} });
      failed.on('error', () => undefined);
      failed.destroy(new Error('fixture'));
      isStreamingBodyConsumed(failed);
    });
  });
  describe('openStreamingBody/cancelStreamingBody', () => {
    it('web reader, node iterator and absent return method', async () => {
      const web = new ReadableStream({
        start(controller) {
          controller.enqueue('one');
          controller.close();
        },
      });
      const opened = openStreamingBody(web);
      await opened.next();
      await opened.return();
      const node = openStreamingBody(Readable.from(['one']));
      await node.next();
      await node.return();
      await openStreamingBody({
        [Symbol.asyncIterator]: () => ({
          next: async () => ({ done: true, value: undefined }),
        }),
      }).return();
      await cancelStreamingBody(new Response(null));
      const locked = new ReadableStream();
      const reader = locked.getReader();
      await cancelStreamingBody(locked);
      await reader.cancel();
      reader.releaseLock();
      await cancelStreamingBody(producer());
      await cancelStreamingBody({
        [Symbol.asyncIterator]() {
          throw new Error('fixture');
        },
      });
    });
  });
  describe('toResponseChunk/inferContentType', () => {
    it.each([
      'text',
      Buffer.from('buffer'),
      new DataView(new ArrayBuffer(2)),
      new ArrayBuffer(2),
      {},
      undefined,
      null,
    ])('chunk %s', value => {
      toResponseChunk(value);
      inferContentType(value);
    });
  });
  describe('getWebResponseHeaders', () => {
    it.each(['default', 'basic'])('response type %s', type => {
      const response = new Response(null, {
        headers: {
          'content-encoding': 'gzip',
          'content-length': '1',
          connection: 'close',
          'set-cookie': 'a=1',
          'x-fixture': 'value',
        },
      });
      Object.defineProperty(response, 'type', { value: type });
      getWebResponseHeaders(response);
    });
    it('fetched without encoding', () => {
      const response = new Response();
      Object.defineProperty(response, 'type', { value: 'basic' });
      getWebResponseHeaders(response);
    });
  });
  describe('toReadable', () => {
    it('first/subsequent/done chunks and iterator finalization', async () => {
      for await (const chunk of toReadable(producer() as any, 'first')) {
        void chunk;
      }
    });
  });
});
