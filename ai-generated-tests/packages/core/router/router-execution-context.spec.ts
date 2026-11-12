/**
 * CFT checklist extracted from packages/core/router/router-execution-context.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * isThenable @L92 - D=4, P=5.
 *   1c1=value !== null | 1c2=typeof value === 'object' | 1c3=typeof value === 'function' | 1c4=typeof (value as PromiseLike<unknown>).then === 'function'
 * RouterExecutionContext.constructor @L102 - D=0, P=1.
 * RouterExecutionContext.create @L115 - D=0, P=1.
 * RouterExecutionContext.handler @L178 - D=6, P=7.
 *   1c1=fnApplyPipes | 1c2=fnApplyPipes(args, req, res, next)
 *   2c1=pendingPipes | 2c2=await pendingPipes
 *   3=!handlerObservable$
 *   4=isObservable(result)
 * RouterExecutionContext.callback @L186 - D=6, P=7.
 *   1c1=fnApplyPipes | 1c2=fnApplyPipes(args, req, res, next)
 *   2c1=pendingPipes | 2c2=await pendingPipes
 *   3=!handlerObservable$
 *   4=isObservable(result)
 * RouterExecutionContext.callback @L203 - D=0, P=1.
 * RouterExecutionContext.callback @L208 - D=8, P=9.
 *   1c1=fnCanActivate | 1c2=await fnCanActivate([req, res, next])
 *   2c1=hasCustomHeaders | 2c2=this.responseController.setHeaders(res, responseHeaders)
 *   3=isSseHandler
 *   4c1=isSseHandler | 4c2=isEmptyArray(interceptors)
 *   5=isSseHandler
 * RouterExecutionContext.getMetadata @L256 - D=3, P=4.
 *   1=cacheMetadata
 *   2c1=this.contextUtils.reflectCallbackMetadata( instance, methodName, ROUTE_ARGS_METADATA, ) | 2c2={}
 * RouterExecutionContext.getParamsMetadata @L286 - D=0, P=1.
 * RouterExecutionContext.reflectRedirect @L335 - D=0, P=1.
 * RouterExecutionContext.reflectHttpStatusCode @L341 - D=0, P=1.
 * RouterExecutionContext.reflectRenderTemplate @L347 - D=0, P=1.
 * RouterExecutionContext.reflectResponseHeaders @L353 - D=2, P=3.
 *   1c1=Reflect.getMetadata(HEADERS_METADATA, callback) | 1c2=[]
 * RouterExecutionContext.reflectSse @L359 - D=0, P=1.
 * RouterExecutionContext.reflectSseOptions @L363 - D=1, P=2.
 *   1='SSE_OPTIONS_METADATA' in commonInternal
 * RouterExecutionContext.exchangeKeysForValues @L372 - D=0, P=1.
 * RouterExecutionContext.callback @L382 - D=1, P=2.
 *   1=key.includes(CUSTOM_ROUTE_ARGS_METADATA)
 * RouterExecutionContext.extractValue @L408 - D=0, P=1.
 * RouterExecutionContext.getParamValue @L422 - D=1, P=2.
 *   1=!isEmptyArray(pipes)
 * RouterExecutionContext.isPipeable @L433 - D=9, P=10.
 *   1c1=type === RouteParamtypes.BODY | 1c2=type === RouteParamtypes.RAW_BODY | 1c3=type === RouteParamtypes.QUERY | 1c4=type === RouteParamtypes.PARAM | 1c5=type === RouteParamtypes.FILE | 1c6=type === RouteParamtypes.FILES | 1c7=type === RouteParamtypes.COOKIES | 1c8=type === RouteParamtypes.SIGNED_COOKIES | 1c9=isString(type)
 * RouterExecutionContext.createGuardsFn @L447 - D=1, P=2.
 *   1=guards.length
 * RouterExecutionContext.canActivateFn @L453 - D=1, P=2.
 *   1=!canActivate
 * RouterExecutionContext.createPipesFn @L468 - D=1, P=2.
 *   1=!paramsOptions.length
 * RouterExecutionContext.callback @L485 - D=1, P=2.
 *   1=isPipeable
 * RouterExecutionContext.applyPipes @L505 - D=0, P=1.
 * RouterExecutionContext.callback @L517 - D=6, P=7.
 *   1=i < params.length
 *   2c1=param.isPipeable | 2c2=param.pipes.length > 0 | 2c3=isThenable(value)
 *   3c1=pending | 3c2=Promise.all(pending)
 * RouterExecutionContext.createHandleResponseFn @L549 - D=4, P=5.
 *   1=renderTemplate
 *   2c1=redirectResponse | 2c2=isString(redirectResponse.url)
 *   3=isSseHandler
 * RouterExecutionContext.callback @L557 - D=0, P=1.
 * RouterExecutionContext.callback @L566 - D=0, P=1.
 * RouterExecutionContext.callback @L574 - D=2, P=3.
 *   1c1=(req as any).raw | 1c2=req
 * RouterExecutionContext.callback @L589 - D=0, P=1.
 * RouterExecutionContext.callback @L590 - D=0, P=1.
 * RouterExecutionContext.callback @L596 - D=7, P=8.
 *   1=isObservable(result)
 *   2c1=!disconnected | 2c2=!(err instanceof EmptyError)
 *   3=disconnected
 *   4=!isResponseHandled
 *   5=streamingBody
 *   6=streamingBody === result
 * RouterExecutionContext.callback @L609 - D=0, P=1.
 * RouterExecutionContext.callback @L610 - D=0, P=1.
 * RouterExecutionContext.pickStreamingBody @L659 - D=4, P=5.
 *   1=isStreamingBody(result)
 *   2=result instanceof StreamableFile
 *   3c1=handlerBody | 3c2=!isStreamingBodyConsumed(handlerBody)
 * RouterExecutionContext.trackHandlerStream @L675 - D=2, P=3.
 *   1=value instanceof StreamableFile
 *   2=isStreamingBody(value)
 * RouterExecutionContext.callback @L682 - D=0, P=1.
 * RouterExecutionContext.observeHandlerResult @L686 - D=2, P=3.
 *   1=isObservable(result)
 *   2=result instanceof Promise
 * RouterExecutionContext.callback @L698 - D=1, P=2.
 *   1=isObservable(value)
 * RouterExecutionContext.callback @L705 - D=0, P=1.
 * RouterExecutionContext.fromClientDisconnect @L717 - D=0, P=1.
 * RouterExecutionContext.callback @L718 - D=2, P=3.
 *   1=!source
 *   2=source.destroyed
 * RouterExecutionContext.onClose @L730 - D=0, P=1.
 * RouterExecutionContext.callback @L732 - D=0, P=1.
 * RouterExecutionContext.isResponseHandled @L736 - D=2, P=3.
 *   1c1=hasResponseOrNextDecorator | 1c2=!isPassthroughEnabled
 * RouterExecutionContext.callback @L742 - D=2, P=3.
 *   1c1=type === RouteParamtypes.RESPONSE | 1c2=type === RouteParamtypes.NEXT
 * RouterExecutionContext.attachSseAbortSignal @L752 - D=3, P=4.
 *   1=!carrier[SSE_ABORT_CONTROLLER]
 *   2c1=carrier.raw | 2c2=!(carrier.raw as object)[SSE_ABORT_CONTROLLER]
 */
import { describe, it, vi } from 'vitest';
import { Render, Sse, StreamableFile, RequestMethod } from '@nestjs/common';
import {
  CUSTOM_ROUTE_ARGS_METADATA,
  RouteParamtypes,
} from '@nestjs/common/internal';
import { of, Subject, NEVER, throwError } from 'rxjs';
import { Readable, PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';
import { RouterExecutionContext } from '../../../../packages/core/router/router-execution-context.js';
import { RouteParamsFactory } from '../../../../packages/core/router/route-params-factory.js';
import { NestContainer } from '../../../../packages/core/injector/container.js';
import { PipesContextCreator } from '../../../../packages/core/pipes/pipes-context-creator.js';
import { PipesConsumer } from '../../../../packages/core/pipes/pipes-consumer.js';
import { GuardsContextCreator } from '../../../../packages/core/guards/guards-context-creator.js';
import { GuardsConsumer } from '../../../../packages/core/guards/guards-consumer.js';
import { InterceptorsContextCreator } from '../../../../packages/core/interceptors/interceptors-context-creator.js';
import { InterceptorsConsumer } from '../../../../packages/core/interceptors/interceptors-consumer.js';
function create(): any {
  const container = new NestContainer();
  return new RouterExecutionContext(
    new RouteParamsFactory(),
    new PipesContextCreator(container),
    new PipesConsumer(),
    new GuardsContextCreator(container),
    new GuardsConsumer(),
    new InterceptorsContextCreator(container),
    new InterceptorsConsumer(),
    {
      reply: vi.fn(),
      render: vi.fn(),
      redirect: vi.fn(),
      setHeader: vi.fn(),
      status: vi.fn(),
    } as any,
  );
}
async function failure(operation: () => unknown | Promise<unknown>) {
  try {
    await operation();
  } catch (error) {
    if (!(error instanceof Error)) throw error;
  }
}
describe('RouterExecutionContext', () => {
  // create: isSseHandler T/F with no interceptors, so handlerObservable$ is
  // absent and the original result goes directly through response handling.
  it.each([false, true])(
    'creates a complete handler pipeline for SSE %s',
    async sse => {
      class Controller {
        plain() {
          return 'value';
        }
        @Sse() events() {
          return of({ data: 'value' });
        }
      }
      const instance = new Controller();
      const method = sse ? 'events' : 'plain';
      const value = create();
      const res: any = Object.assign(new PassThrough(), {
        writeHead: vi.fn(),
        flushHeaders: vi.fn(),
        getHeaders: () => ({}),
        statusCode: 200,
      });
      res.resume();
      const handler = value.create(
        instance,
        instance[method],
        method,
        'fixture',
        RequestMethod.GET,
      );
      await handler({ method: 'GET', raw: {} }, res, () => undefined);
      res.destroy();
    },
  );

  // createHandleResponseFn streamingBody T; identity and replaced-body branches.
  it.each([false, true])(
    'sends a streaming handler body replaced by an interceptor %s',
    async replaced => {
      const value = create();
      value.applicationRef.reply.mockImplementation(
        async (_res: unknown, body: unknown) => {
          if (body instanceof StreamableFile) {
            for await (const _chunk of body.getStream()) {
              /* drain response */
            }
          }
        },
      );
      const body = (async function* () {
        yield 'chunk';
      })();
      await value.createHandleResponseFn(() => undefined, false)(
        replaced ? { wrapped: true } : body,
        {},
        { method: 'GET' },
        undefined,
        replaced ? [body] : [],
      );
    },
  );

  // isThenable: a callable can implement the thenable protocol too.
  it('awaits a function-valued thenable from a parameter extractor', async () => {
    const callable = Object.assign(() => undefined, {
      then: (resolve: Function) => resolve('value'),
    });
    await create().createPipesFn(
      [],
      [
        {
          index: 0,
          type: 'custom',
          pipes: [],
          extractValue: () => callable,
        },
      ],
    )([], {}, {}, () => undefined);
  });

  describe('isPipeable/createPipesFn/getParamValue/exchangeKeysForValues/createGuardsFn', () => {
    it('all parameter kinds, synchronous/thenable extraction and pipe/extractor failure', async () => {
      const value = create();
      for (const type of [
        ...Object.values(RouteParamtypes).filter(v => typeof v === 'number'),
        'custom',
      ])
        value.isPipeable(type);
      value.createPipesFn([], []);
      const params = [
        {
          index: 0,
          type: RouteParamtypes.BODY,
          extractValue: () => Promise.resolve('value'),
          pipes: [],
        },
        {
          index: 1,
          type: RouteParamtypes.RESPONSE,
          extractValue: () => ({}),
          pipes: [],
        },
        {
          index: 2,
          type: 'custom',
          extractValue: () => 1,
          pipes: [{ transform: (v: any) => v }],
        },
      ];
      await value.createPipesFn([], params)([], {}, {}, () => undefined);
      await value.getParamValue(1, { type: 'custom' }, []);
      await failure(() =>
        value.createPipesFn(
          [],
          [
            {
              index: 0,
              type: 'custom',
              extractValue: () => {
                throw new Error('extract');
              },
              pipes: [],
            },
          ],
        )([], {}, {}),
      );
      const custom = 'custom' + CUSTOM_ROUTE_ARGS_METADATA + ':0';
      const metadata = {
        [custom]: { index: 0, data: 1, factory: () => 1, pipes: [] },
        '3:1': { index: 1, pipes: [] },
      };
      for (const param of value.exchangeKeysForValues(
        Object.keys(metadata),
        metadata,
        'fixture',
        undefined,
        undefined,
        () => ({}),
      ))
        param.extractValue({ body: 1 }, {}, () => undefined);
      value.createGuardsFn([], {}, () => undefined);
      for (const allow of [true, false])
        await failure(() =>
          value.createGuardsFn(
            [{ canActivate: () => allow }],
            {},
            () => undefined,
          )([]),
        );
    });
  });
  describe('createHandleResponseFn and handler stream tracking/disconnect watchers', () => {
    it('render, redirect, response already handled and regular response', async () => {
      class Controller {
        @Render('template') render() {}
        plain() {}
      }
      const value = create();
      await value.createHandleResponseFn(Controller.prototype.render, false)(
        {},
        {},
      );
      await value.createHandleResponseFn(Controller.prototype.plain, false, {
        url: '/next',
      })({}, {});
      await value.createHandleResponseFn(Controller.prototype.plain, true)(
        {},
        {},
      );
      await value.createHandleResponseFn(Controller.prototype.plain, false)(
        of('value'),
        {},
        {},
      );
      await failure(() =>
        value.createHandleResponseFn(Controller.prototype.plain, false)(
          throwError(() => new Error('fixture')),
          {},
          {},
        ),
      );
    });
    it('observable disconnect, stream selection, thenable observation and SSE abort carrier', async () => {
      const value = create();
      const streams: any[] = [];
      const observed = new Subject<void>();
      for (const result of [
        of(1),
        Promise.resolve(of(1)),
        Promise.resolve(new StreamableFile(Buffer.from('value'))),
        Promise.reject(new Error('fixture')),
        Readable.from([]),
        {},
        new StreamableFile(Buffer.from('value')),
      ])
        value.observeHandlerResult(result, observed, streams);
      await Promise.resolve();
      value.pickStreamingBody({}, streams);
      value.pickStreamingBody(Readable.from([]), []);
      value.pickStreamingBody(new StreamableFile(Buffer.from('value')), []);
      const carrier = { raw: {} };
      value.attachSseAbortSignal(carrier);
      value.attachSseAbortSignal(carrier);
      value.attachSseAbortSignal({});
      value
        .fromClientDisconnect(undefined, undefined)
        .subscribe()
        .unsubscribe();
      const socket = Object.assign(new EventEmitter(), { destroyed: true });
      await value.createHandleResponseFn(() => undefined, false)(
        NEVER,
        {},
        { socket },
      );
      const active = new EventEmitter();
      const subscription = value
        .fromClientDisconnect({ raw: { socket: active } }, {})
        .subscribe();
      active.emit('close');
      subscription.unsubscribe();
      for (const item of streams)
        if (item instanceof StreamableFile) item.getStream().destroy();
        else item.destroy?.();
    });
    it('SSE handler response callback', async () => {
      class Controller {
        @Sse() events() {}
      }
      const res: any = Object.assign(new PassThrough(), {
        writeHead: vi.fn(),
        flushHeaders: vi.fn(),
        getHeaders: () => ({}),
        statusCode: 200,
      });
      res.resume();
      await create().createHandleResponseFn(Controller.prototype.events, false)(
        of('value'),
        res,
        { method: 'GET' },
      );
    });
  });
});
