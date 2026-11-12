/**
 * CFT checklist extracted from packages/core/router/router-response-controller.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * isCloseSource @L59 - D=0, P=1.
 * pickCloseSource @L65 - D=2, P=3.
 *   1=isCloseSource(socket)
 *   2=isCloseSource(response)
 * getDataLength @L75 - D=2, P=3.
 *   1=isString(message.data)
 *   2=isString(message.comment)
 * RouterResponseController.constructor @L96 - D=0, P=1.
 * RouterResponseController.apply @L98 - D=0, P=1.
 * RouterResponseController.stream @L119 - D=9, P=10.
 *   1=isWebResponse(body)
 *   2=webResponse
 *   3=isStreamingBodyConsumed(body)
 *   4=isNil(source)
 *   5=rawRequest.method === 'HEAD'
 *   6=!first
 *   7=first.done
 *   8=!isNil(options.replacement)
 *   9=webResponse
 * RouterResponseController.reply @L133 - D=0, P=1.
 * RouterResponseController.callback @L157 - D=0, P=1.
 * RouterResponseController.callback @L177 - D=0, P=1.
 * RouterResponseController.callback @L184 - D=1, P=2.
 *   1=!(err instanceof IntrinsicException)
 * RouterResponseController.callback @L191 - D=0, P=1.
 * RouterResponseController.readFirst @L204 - D=1, P=2.
 *   1=disconnectSource?.destroyed
 * RouterResponseController.callback @L213 - D=0, P=1.
 * RouterResponseController.onClose @L214 - D=0, P=1.
 * RouterResponseController.callback @L219 - D=0, P=1.
 * RouterResponseController.setWebResponseHeaders @L223 - D=3, P=4.
 *   1=!webResponse
 *   2=next iteration of getWebResponseHeaders(webResponse)
 *   3=next iteration of webResponse.headers.getSetCookie()
 * RouterResponseController.redirect @L242 - D=5, P=6.
 *   1c1=result | 1c2=result.statusCode
 *   2=redirectResponse.statusCode
 *   3c1=result | 3c2=result.url
 * RouterResponseController.render @L258 - D=0, P=1.
 * RouterResponseController.transformToResult @L267 - D=1, P=2.
 *   1=isObservable(resultOrDeferred)
 * RouterResponseController.getStatusByMethod @L274 - D=1, P=2.
 *   1=case RequestMethod.POST
 * RouterResponseController.setHeaders @L283 - D=0, P=1.
 * RouterResponseController.callback @L287 - D=1, P=2.
 *   1=typeof value === 'function'
 * RouterResponseController.setStatus @L296 - D=0, P=1.
 * RouterResponseController.sse @L303 - D=1, P=2.
 *   1=response.writableEnded
 * RouterResponseController.callback @L323 - D=0, P=1.
 * RouterResponseController.callback @L336 - D=1, P=2.
 *   1=disconnectSource?.destroyed
 * RouterResponseController.finalize @L350 - D=0, P=1.
 * RouterResponseController.endStream @L355 - D=1, P=2.
 *   1=!stream.writableEnded
 * RouterResponseController.fail @L365 - D=0, P=1.
 * RouterResponseController.commitHeaders @L377 - D=0, P=1.
 * RouterResponseController.onClose @L387 - D=1, P=2.
 *   1=settled
 * RouterResponseController.callback @L408 - D=2, P=3.
 *   1=settled
 *   2=settled
 * RouterResponseController.callback @L419 - D=0, P=1.
 * RouterResponseController.dropIfNotReading @L431 - D=3, P=4.
 *   1c1=maxPendingDataLength | 1c2=pendingDataLength > maxPendingDataLength | 1c3=stream.writableNeedDrain
 * RouterResponseController.callback @L446 - D=3, P=4.
 *   1=isObject(message)
 *   2c1=isNil(event.data) | 2c2=isString(event.data)
 * RouterResponseController.callback @L466 - D=0, P=1.
 * RouterResponseController.callback @L471 - D=0, P=1.
 * RouterResponseController.callback @L472 - D=0, P=1.
 * RouterResponseController.callback @L473 - D=1, P=2.
 *   1=err
 * RouterResponseController.callback @L484 - D=4, P=5.
 *   1=!stream.headersCommitted
 *   2=err instanceof HttpException
 *   3=this.exceptionFilter.isHttpError(err)
 *   4=!(err instanceof IntrinsicException)
 * RouterResponseController.callback @L502 - D=1, P=2.
 *   1=writeError
 * RouterResponseController.callback @L512 - D=1, P=2.
 *   1=settled
 * RouterResponseController.callback @L518 - D=2, P=3.
 *   1=settled
 *   2=!commitHeaders()
 * RouterResponseController.callback @L545 - D=3, P=4.
 *   1c1=settled | 1c2=!commitHeaders()
 *   2=request.method === 'HEAD'
 * RouterResponseController.callback @L561 - D=1, P=2.
 *   1=settled
 * RouterResponseController.assertObservable @L571 - D=1, P=2.
 *   1=!isObservable(value)
 * RouterResponseController.getOrCreateAbortController @L579 - D=1, P=2.
 *   1=!carrier[SSE_ABORT_CONTROLLER]
 */
import { afterEach, describe, it, vi } from 'vitest';
import { PassThrough, Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { of, EMPTY, NEVER, Subject, throwError } from 'rxjs';
import {
  HttpException,
  IntrinsicException,
  Logger,
  StreamableFile,
  RequestMethod,
  SSE_ABORT_CONTROLLER,
} from '@nestjs/common';
import {
  RouterResponseController,
  pickCloseSource,
} from '../../../../packages/core/router/router-response-controller.js';
import { SseStream } from '../../../../packages/core/router/sse-stream.js';

afterEach(() => vi.restoreAllMocks());
function response(): any {
  const res = new PassThrough();
  res.resume();
  return Object.assign(res, {
    statusCode: 200,
    writeHead: vi.fn(),
    flushHeaders: vi.fn(),
  });
}
function controller(extra: any = {}): any {
  return new RouterResponseController({
    reply: async (_res: any, body: any) => {
      if (body instanceof StreamableFile)
        for await (const chunk of body.getStream()) {
          void chunk;
        }
    },
    redirect: vi.fn(),
    render: vi.fn(),
    setHeader: vi.fn(),
    appendHeader: vi.fn(),
    status: vi.fn(),
    ...extra,
  } as any);
}
async function failure(operation: () => unknown | Promise<unknown>) {
  try {
    await operation();
  } catch (error) {
    if (!(error instanceof Error)) throw error;
  }
}
async function* generator() {
  yield 'first';
  yield { next: true };
}
describe('RouterResponseController', () => {
  describe('apply/redirect/render/transformToResult/getStatusByMethod/setHeaders/setStatus', () => {
    it('plain/observable results, redirect precedence and literal/function headers', async () => {
      const value = controller();
      await value.apply({}, {});
      for (const result of [
        undefined,
        {},
        { url: '/dynamic', statusCode: 301 },
      ])
        for (const statusCode of [undefined, 302])
          await value.redirect(result, {}, { url: '/default', statusCode });
      await value.render(of({}), {}, 'view');
      await value.transformToResult(Promise.resolve('value'));
      value.getStatusByMethod(RequestMethod.POST);
      value.getStatusByMethod(RequestMethod.GET);
      value.setHeaders({}, [
        { name: 'x-static', value: 'value' },
        { name: 'x-function', value: () => 'value' },
      ]);
      value.setStatus({}, 201);
    });
  });
  describe('stream/setWebResponseHeaders/readFirst', () => {
    it.each([
      'generator',
      'web stream',
      'web response',
      'empty response',
      'empty iterator',
      'replacement',
      'HEAD',
    ])('body %s', async mode => {
      const value = controller();
      const res = response();
      const request: any = {
        method: mode === 'HEAD' ? 'HEAD' : 'GET',
        socket: new EventEmitter(),
      };
      const body =
        mode === 'web stream'
          ? new ReadableStream({
              start(c) {
                c.enqueue('value');
                c.close();
              },
            })
          : mode === 'web response'
            ? new Response('value', {
                headers: { 'set-cookie': 'a=1', 'x-fixture': 'value' },
              })
            : mode === 'empty response'
              ? new Response(null)
              : ['empty iterator', 'replacement'].includes(mode)
                ? Readable.from([])
                : generator();
      await value.stream(
        body,
        res,
        { raw: request },
        {
          statusCode: 201,
          replacement: mode === 'replacement' ? 'replacement' : undefined,
        },
      );
      res.destroy();
    });
    it('consumed stream rejected and already disconnected client', async () => {
      const locked = new ReadableStream();
      const reader = locked.getReader();
      await failure(() =>
        controller().stream(locked, response(), { method: 'GET' }),
      );
      await reader.cancel();
      reader.releaseLock();
      const socket = Object.assign(new EventEmitter(), { destroyed: true });
      await controller().stream(generator(), response(), {
        method: 'GET',
        socket,
      });
    });
    it('disconnect while first chunk pending and iterator return failure', async () => {
      const source: any = {
        [Symbol.asyncIterator]: () => ({
          next: () => new Promise(() => undefined),
          return: () => Promise.reject(new Error('cleanup')),
        }),
      };
      const res = response();
      const socket = new EventEmitter();
      const pending = controller().stream(source, res, {
        method: 'GET',
        socket,
      });
      socket.emit('close');
      await pending;
      res.destroy();
    });
    it('serialization failure, adapter failure and producer error', async () => {
      vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      async function* bigint() {
        yield 1n;
      }
      async function* broken() {
        yield 'first';
        throw new Error('producer');
      }
      await failure(() =>
        controller().stream(bigint(), response(), { method: 'GET' }),
      );
      await failure(() =>
        controller({
          reply: () => {
            throw new Error('adapter');
          },
        }).stream(generator(), response(), { method: 'GET' }),
      );
      await failure(() =>
        controller().stream(broken(), response(), { method: 'GET' }),
      );
      await failure(() =>
        controller().stream(
          {
            [Symbol.asyncIterator]: () => ({
              next: () => Promise.reject(new Error('first')),
            }),
          },
          response(),
          { method: 'GET' },
        ),
      );
    });
  });
  describe('pickCloseSource/isCloseSource', () => {
    it.each([
      [new EventEmitter(), {}],
      [{}, new EventEmitter()],
      [undefined, undefined],
    ])('sources %s/%s', (socket, res) => {
      pickCloseSource(socket, res);
    });
  });
  describe('sse/assertObservable/getOrCreateAbortController', () => {
    it.each([
      EMPTY,
      of('text'),
      of({ data: { value: 1 }, comment: 'comment' }),
      of({ comment: 'keepalive' }),
      of({ data: null }),
    ])('producer %s', async observable => {
      const request: any = {
        method: 'GET',
        socket: new EventEmitter(),
        [SSE_ABORT_CONTROLLER]: new AbortController(),
      };
      const res = response();
      await controller().sse(observable, res, request, {
        additionalHeaders: { 'x-fixture': 'value' },
        statusCode: 201,
      });
    });
    it.each(['HEAD', 'disconnect', 'already destroyed', 'response fallback'])(
      'lifetime %s',
      async mode => {
        const res = response();
        const socket: any = Object.assign(new EventEmitter(), {
          destroyed: mode === 'already destroyed',
        });
        const req: any = {
          method: mode === 'HEAD' ? 'HEAD' : 'GET',
          socket: mode === 'response fallback' ? {} : socket,
        };
        const pending = controller().sse(NEVER, res, req);
        if (mode === 'disconnect') socket.emit('close');
        if (mode === 'response fallback') res.emit('close');
        await pending;
        res.destroy();
      },
    );
    it('ended response and late rejection', async () => {
      vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const res = response();
      res.end();
      await controller().sse(Promise.reject(new Error('late')), res, {
        method: 'GET',
      });
      await new Promise(resolve => setImmediate(resolve));
    });
    it.each([
      () => Promise.reject(new Error('setup')),
      () => of({ data: 1n }),
      () => 42,
    ])('setup failure %#', async input => {
      const result = input();
      await failure(() =>
        controller().sse(result, response(), { method: 'GET' }),
      );
    });
    it('header validation failure', async () => {
      const res = response();
      res.writeHead = () => {
        throw new TypeError('header');
      };
      await failure(() => controller().sse(EMPTY, res, { method: 'GET' }));
      res.destroy();
    });
    it.each([
      new HttpException('http', 400),
      new IntrinsicException(),
      new Error('unknown'),
      { statusCode: 400, message: 'http shape' },
    ])('error after headers %s', async error => {
      vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const subject = new Subject();
      const res = response();
      const pending = controller().sse(subject, res, {
        method: 'GET',
        socket: new EventEmitter(),
      });
      await new Promise(resolve => setImmediate(resolve));
      subject.next({ data: 'first' });
      await new Promise(resolve => setImmediate(resolve));
      subject.error(error);
      await pending;
      res.destroy();
    });
    it('write callback failure after headers', async () => {
      vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const original = SseStream.prototype.writeMessage;
      let count = 0;
      vi.spyOn(SseStream.prototype, 'writeMessage').mockImplementation(
        function (message, cb) {
          if (count++ > 0) cb(new Error('write'));
          else original.call(this, message, cb);
        },
      );
      await controller().sse(of('first', 'second'), response(), {
        method: 'GET',
        socket: new EventEmitter(),
      });
    });
    it('backed-up event queue exceeds maximum', async () => {
      vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      vi.spyOn(SseStream.prototype, 'writeMessage').mockImplementation(
        function (_message, _cb) {
          Object.defineProperty(this, 'writableNeedDrain', { value: true });
        },
      );
      await controller().sse(
        of({ data: 'long data', comment: 'comment' }),
        response(),
        { method: 'GET', socket: new EventEmitter() },
        { maxPendingDataLength: 1 },
      );
    });
  });
});
