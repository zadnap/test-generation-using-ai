import {
  RESPONSE_PASSTHROUGH_METADATA,
  ROUTE_ARGS_METADATA,
} from '../../../../../packages/common/constants.js';
import {
  assignMetadata,
  Body,
  Cookies,
  Headers,
  HostParam,
  Ip,
  Next,
  Param,
  Query,
  RawBody,
  Req,
  Request,
  Res,
  Response,
  Session,
  SignedCookies,
  UploadedFile,
  UploadedFiles,
} from '../../../../../packages/common/decorators/http/route-params.decorator.js';
import { RouteParamtypes } from '../../../../../packages/common/enums/route-paramtypes.enum.js';

class Pipe {
  transform(value: unknown) {
    return value;
  }
}

const pipeInstance = { transform: (value: unknown) => value };
const schema = { '~standard': { validate: () => undefined } };

function register(decorator: any, args: any[] = [], index = 0) {
  class Target {
    method() {}
  }
  decorator(...args)(Target.prototype, 'method', index);
  return {
    Target,
    metadata: Reflect.getMetadata(ROUTE_ARGS_METADATA, Target, 'method'),
  };
}

function entry(Target: any, parameterType: RouteParamtypes, index = 0) {
  const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, Target, 'method');
  return metadata[`${parameterType}:${index}`];
}

describe('assignMetadata', () => {
  it('normalizes an options object with data and pipes', () => {
    expect(
      assignMetadata({}, RouteParamtypes.BODY, 0, {
        data: 'value',
        pipes: [Pipe],
      }),
    ).toEqual({
      '3:0': { index: 0, data: 'value', pipes: [Pipe] },
    });
  });

  it('keeps schema when the options object defines one', () => {
    const result = assignMetadata({}, RouteParamtypes.QUERY, 1, {
      schema,
    });

    expect(result['4:1']).toEqual({
      index: 1,
      data: undefined,
      pipes: [],
      schema,
    });
  });

  it('supports the legacy positional data and pipes signature', () => {
    const result = assignMetadata(
      {},
      RouteParamtypes.PARAM,
      2,
      'legacy',
      Pipe,
    );

    expect(result['5:2']).toEqual({
      index: 2,
      data: 'legacy',
      pipes: [Pipe],
    });
  });

  it('falls back to treating an object with legacy pipes as data', () => {
    const data = { data: 'value' };
    const result = assignMetadata({}, RouteParamtypes.QUERY, 0, data, Pipe);

    expect(result['4:0']).toEqual({
      index: 0,
      data,
      pipes: [Pipe],
    });
  });

  it('does not treat transformed objects, null, or primitives as options', () => {
    const transformed = { data: 'value', transform: () => 'value' };
    const transformOnly = { transform: () => 'value' };

    expect(
      assignMetadata({}, RouteParamtypes.BODY, 0, transformed)['3:0'].data,
    ).toBe(transformed);
    expect(
      assignMetadata({}, RouteParamtypes.BODY, 1, transformOnly)['3:1'].data,
    ).toBe(transformOnly);
    expect(
      assignMetadata({}, RouteParamtypes.BODY, 2, null as any)['3:2'].data,
    ).toBeNull();
    expect(
      assignMetadata({}, RouteParamtypes.BODY, 3, 'raw')['3:3'].data,
    ).toBe('raw');
  });
});

describe('route parameter decorators', () => {
  it.each([
    [Request, RouteParamtypes.REQUEST, 'custom'],
    [Next, RouteParamtypes.NEXT, undefined],
    [Ip, RouteParamtypes.IP, undefined],
    [Session, RouteParamtypes.SESSION, undefined],
    [Headers, RouteParamtypes.HEADERS, 'X-Test'],
    [HostParam, RouteParamtypes.HOST, 'id'],
  ])('registers %# with its parameter type and data', (decorator, type, data) => {
    const { Target } = register(decorator, [data]);

    expect(entry(Target, type)).toEqual({
      index: 0,
      data,
      pipes: [],
    });
  });

  it('accumulates multiple route parameters on one handler', () => {
    class Target {
      method() {}
    }
    Request()(Target.prototype, 'method', 0);
    Next()(Target.prototype, 'method', 1);

    expect(entry(Target, RouteParamtypes.REQUEST, 0).index).toBe(0);
    expect(entry(Target, RouteParamtypes.NEXT, 1).index).toBe(1);
  });

  it('registers Response and optional pass-through metadata', () => {
    const withoutOptions = register(Response, []);
    const disabled = register(Response, [{ passthrough: false }]);
    const enabled = register(Response, [{ passthrough: true }]);

    expect(entry(withoutOptions.Target, RouteParamtypes.RESPONSE).data).toBeUndefined();
    expect(
      Reflect.getMetadata(
        RESPONSE_PASSTHROUGH_METADATA,
        withoutOptions.Target,
        'method',
      ),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(
        RESPONSE_PASSTHROUGH_METADATA,
        disabled.Target,
        'method',
      ),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(
        RESPONSE_PASSTHROUGH_METADATA,
        enabled.Target,
        'method',
      ),
    ).toBe(true);
  });

  it('exposes Req and Res as aliases', () => {
    expect(Req).toBe(Request);
    expect(Res).toBe(Response);
  });
});

describe.each([
  ['Query', Query, RouteParamtypes.QUERY],
  ['Body', Body, RouteParamtypes.BODY],
  ['Param', Param, RouteParamtypes.PARAM],
])('%s', (_name, decorator, parameterType) => {
  it.each([
    {
      label: 'no arguments',
      args: [],
      data: undefined,
      pipes: [],
      schema: undefined,
    },
    {
      label: 'options first',
      args: [{ schema, pipes: [Pipe] }],
      data: undefined,
      pipes: [Pipe],
      schema,
    },
    {
      label: 'options first without pipes',
      args: [{ schema }],
      data: undefined,
      pipes: [],
      schema,
    },
    {
      label: 'property and options',
      args: ['id', { schema, pipes: [Pipe] }],
      data: 'id',
      pipes: [Pipe],
      schema,
    },
    {
      label: 'property and options without pipes',
      args: ['id', { schema }],
      data: 'id',
      pipes: [],
      schema,
    },
    {
      label: 'property and pipe',
      args: ['id', Pipe],
      data: 'id',
      pipes: [Pipe],
      schema: undefined,
    },
    {
      label: 'property with a skipped pipe',
      args: ['id', undefined, Pipe],
      data: 'id',
      pipes: [Pipe],
      schema: undefined,
    },
    {
      label: 'pipe only',
      args: [Pipe],
      data: undefined,
      pipes: [Pipe],
      schema: undefined,
    },
  ])('handles $label', testCase => {
    const { Target } = register(decorator, testCase.args);

    expect(entry(Target, parameterType)).toEqual({
      index: 0,
      data: testCase.data,
      pipes: testCase.pipes,
      ...(testCase.schema === undefined ? {} : { schema: testCase.schema }),
    });
  });
});

describe('RawBody', () => {
  it.each([
    { args: [], pipes: [], schema: undefined },
    { args: [Pipe], pipes: [Pipe], schema: undefined },
    { args: [{ schema, pipes: [Pipe] }], pipes: [Pipe], schema },
    { args: [{ schema, pipes: undefined }], pipes: [], schema },
    { args: [undefined, Pipe], pipes: [Pipe], schema: undefined },
  ])('registers raw body options: %#', testCase => {
    const { Target } = register(RawBody, testCase.args);

    expect(entry(Target, RouteParamtypes.RAW_BODY)).toEqual({
      index: 0,
      data: undefined,
      pipes: testCase.pipes,
      ...(testCase.schema === undefined ? {} : { schema: testCase.schema }),
    });
  });
});

describe('UploadedFile and UploadedFiles', () => {
  it.each([
    { label: 'file defaults', args: [], data: undefined, pipes: [] },
    {
      label: 'file key and pipes',
      args: ['file', Pipe],
      data: 'file',
      pipes: [Pipe],
    },
    {
      label: 'pipe as the file key',
      args: [Pipe, pipeInstance],
      data: undefined,
      pipes: [Pipe, pipeInstance],
    },
  ])('handles $label', testCase => {
    const { Target } = register(UploadedFile, testCase.args);

    expect(entry(Target, RouteParamtypes.FILE)).toEqual({
      index: 0,
      data: testCase.data,
      pipes: testCase.pipes,
    });
  });

  it.each([
    { args: [], pipes: [] },
    { args: [Pipe], pipes: [Pipe] },
  ])('registers uploaded files: %#', testCase => {
    const { Target } = register(UploadedFiles, testCase.args);

    expect(entry(Target, RouteParamtypes.FILES)).toEqual({
      index: 0,
      data: undefined,
      pipes: testCase.pipes,
    });
  });
});

describe('cookie parameter decorators', () => {
  it.each([
    {
      label: 'all cookies',
      decorator: Cookies,
      type: RouteParamtypes.COOKIES,
      args: [],
      data: undefined,
      pipes: [],
    },
    {
      label: 'named cookie with pipes',
      decorator: Cookies,
      type: RouteParamtypes.COOKIES,
      args: ['theme', Pipe],
      data: 'theme',
      pipes: [Pipe],
    },
    {
      label: 'pipe instance as cookie data',
      decorator: SignedCookies,
      type: RouteParamtypes.SIGNED_COOKIES,
      args: [pipeInstance, Pipe],
      data: undefined,
      pipes: [pipeInstance, Pipe],
    },
    {
      label: 'null cookie data',
      decorator: SignedCookies,
      type: RouteParamtypes.SIGNED_COOKIES,
      args: [null],
      data: null,
      pipes: [],
    },
  ])('handles $label', testCase => {
    const { Target } = register(testCase.decorator, testCase.args);

    expect(entry(Target, testCase.type)).toEqual({
      index: 0,
      data: testCase.data,
      pipes: testCase.pipes,
    });
  });
});
