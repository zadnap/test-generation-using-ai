import { describe, expect, it } from 'vitest';
import {
  RESPONSE_PASSTHROUGH_METADATA,
  ROUTE_ARGS_METADATA,
} from '../../../../../packages/common/constants.js';
import {
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
  assignMetadata,
} from '../../../../../packages/common/decorators/http/route-params.decorator.js';

class Pipe {
  transform(value: unknown) {
    return value;
  }
}

const pipeInstance = { transform: (value: unknown) => value };
const schema = { '~standard': { validate: () => ({ value: undefined }) } } as any;

function paramMeta(decorate: ParameterDecorator, index = 0) {
  class Target {
    handler() {}
  }
  decorate(Target.prototype, 'handler', index);
  const metadata = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    Target,
    'handler',
  );
  return Object.values(metadata).find((arg: any) => arg.index === index) as any;
}

describe('assignMetadata', () => {
  it('xc1(F): normalizes legacy positional data and pipes', () => {
    const result = assignMetadata({}, 7, 0, 'raw', Pipe);

    expect(result).toEqual({
      '7:0': { index: 0, data: 'raw', pipes: [Pipe] },
    });
    expect('schema' in result['7:0']).toBe(false);
  });

  it('xc1(T): normalizes an options object carrying data and pipes', () => {
    const result = assignMetadata({}, 7, 0, {
      data: 'user',
      pipes: [Pipe],
    });

    expect(result['7:0']).toEqual({
      index: 0,
      data: 'user',
      pipes: [Pipe],
    });
  });

  it('xc2(T): detects an options object through isParameterDecoratorOptions', () => {
    const result = assignMetadata({}, 7, 0, { schema });

    expect(result['7:0']).toEqual({
      index: 0,
      data: undefined,
      pipes: [],
      schema,
    });
  });

  it('xc3(F): does not treat an object exposing transform() as options', () => {
    const options = { data: 'x', transform: () => undefined };

    const result = assignMetadata({}, 7, 0, options as any);

    expect(result['7:0']).toEqual({
      index: 0,
      data: options,
      pipes: [],
    });
  });

  it('xc3(F): does not treat an options object with legacy pipes as options', () => {
    const options = { data: 'x' };

    const result = assignMetadata({}, 7, 0, options, Pipe);

    expect(result['7:0']).toEqual({
      index: 0,
      data: options,
      pipes: [Pipe],
    });
  });

  it('xc1(F): keeps null data as-is', () => {
    const result = assignMetadata({}, 7, 0, null);

    expect(result['7:0']).toEqual({
      index: 0,
      data: null,
      pipes: [],
    });
  });

  it('preserves existing argument entries', () => {
    const existing = { '1:1': { index: 1, data: 'old', pipes: [] } };

    const result = assignMetadata(existing as any, 7, 0, 'raw');

    expect(result['1:1']).toBe(existing['1:1']);
    expect(result['7:0']).toEqual({
      index: 0,
      data: 'raw',
      pipes: [],
    });
  });
});

describe('simple route parameter decorators', () => {
  it.each([
    ['Request', Request],
    ['Next', Next],
    ['Ip', Ip],
    ['Session', Session],
    ['Headers', Headers],
    ['HostParam', HostParam],
  ])('%s() stores no data', (_name, decorate: any) => {
    expect(paramMeta(decorate())).toEqual({
      index: 0,
      data: undefined,
      pipes: [],
    });
  });

  it('Headers(property) stores the property name', () => {
    expect(paramMeta(Headers('x-token'))).toEqual({
      index: 0,
      data: 'x-token',
      pipes: [],
    });
  });

  it('HostParam(property) stores the property name', () => {
    expect(paramMeta(HostParam('id'))).toEqual({
      index: 0,
      data: 'id',
      pipes: [],
    });
  });

  it('HostParam(pipe) keeps the pipe as data', () => {
    expect(paramMeta(HostParam(Pipe))).toEqual({
      index: 0,
      data: Pipe,
      pipes: [],
    });
  });

  it('Req and Res are aliases', () => {
    expect(Req).toBe(Request);
    expect(Res).toBe(Response);
  });
});

describe('Response', () => {
  it('xc1(F): does not set passthrough metadata by default', () => {
    class Target {
      handler() {}
    }

    Response()(Target.prototype, 'handler', 0);

    expect(
      Reflect.getMetadata(RESPONSE_PASSTHROUGH_METADATA, Target, 'handler'),
    ).toBeUndefined();
    expect(
      Object.values(
        Reflect.getMetadata(ROUTE_ARGS_METADATA, Target, 'handler'),
      )[0],
    ).toEqual({ index: 0, data: undefined, pipes: [] });
  });

  it('xc1(T): sets passthrough metadata when enabled', () => {
    class Target {
      handler() {}
    }

    Response({ passthrough: true })(Target.prototype, 'handler', 0);

    expect(
      Reflect.getMetadata(RESPONSE_PASSTHROUGH_METADATA, Target, 'handler'),
    ).toBe(true);
  });

  it('xc1(F): does not set passthrough metadata when disabled', () => {
    class Target {
      handler() {}
    }

    Response({ passthrough: false })(Target.prototype, 'handler', 0);

    expect(
      Reflect.getMetadata(RESPONSE_PASSTHROUGH_METADATA, Target, 'handler'),
    ).toBeUndefined();
  });
});

describe('UploadedFile', () => {
  it('xc1(T): stores no data and no pipes by default', () => {
    expect(paramMeta(UploadedFile())).toEqual({
      index: 0,
      data: undefined,
      pipes: [],
    });
  });

  it('xc2(T): stores a string file key and pipes', () => {
    expect(paramMeta(UploadedFile('avatar', Pipe))).toEqual({
      index: 0,
      data: 'avatar',
      pipes: [Pipe],
    });
  });

  it('xc2(F): treats a pipe as a pipe, not as a file key', () => {
    expect(paramMeta(UploadedFile(Pipe))).toEqual({
      index: 0,
      data: undefined,
      pipes: [Pipe],
    });
  });
});

describe('UploadedFiles', () => {
  it('stores no data and no pipes by default', () => {
    expect(paramMeta(UploadedFiles())).toEqual({
      index: 0,
      data: undefined,
      pipes: [],
    });
  });

  it('stores the provided pipes', () => {
    expect(paramMeta(UploadedFiles(Pipe))).toEqual({
      index: 0,
      data: undefined,
      pipes: [Pipe],
    });
  });
});

describe.each([
  ['Query', Query],
  ['Body', Body],
  ['Param', Param],
])('%s', (_name, decorate: any) => {
  it('xc1(T), xc2(F): stores no data and no pipes when called empty', () => {
    expect(paramMeta(decorate())).toEqual({
      index: 0,
      data: undefined,
      pipes: [],
    });
  });

  it('xc1(T): stores a string property', () => {
    expect(paramMeta(decorate('user'))).toEqual({
      index: 0,
      data: 'user',
      pipes: [],
    });
  });

  it('xc1(F): treats a pipe class as a pipe', () => {
    expect(paramMeta(decorate(Pipe))).toEqual({
      index: 0,
      data: undefined,
      pipes: [Pipe],
    });
  });

  it('xc1(F): treats a pipe instance as a pipe', () => {
    expect(paramMeta(decorate(pipeInstance))).toEqual({
      index: 0,
      data: undefined,
      pipes: [pipeInstance],
    });
  });

  it('xc2(T): accepts an options object as the only argument', () => {
    expect(paramMeta(decorate({ schema, pipes: [Pipe] }))).toEqual({
      index: 0,
      data: undefined,
      pipes: [Pipe],
      schema,
    });
  });

  it('xc2(F), xc3(T): accepts a property plus an options object', () => {
    expect(paramMeta(decorate('user', { schema, pipes: [Pipe] }, Pipe))).toEqual(
      {
        index: 0,
        data: 'user',
        pipes: [Pipe, Pipe],
        schema,
      },
    );
  });

  it('xc3(F): accepts a property plus a pipe', () => {
    expect(paramMeta(decorate('user', Pipe))).toEqual({
      index: 0,
      data: 'user',
      pipes: [Pipe],
    });
  });

  it('xc3(F): filters falsy trailing arguments', () => {
    expect(paramMeta(decorate('user', null))).toEqual({
      index: 0,
      data: 'user',
      pipes: [],
    });
  });
});

describe('RawBody', () => {
  it('xc1(F): stores no pipes by default', () => {
    expect(paramMeta(RawBody())).toEqual({
      index: 0,
      data: undefined,
      pipes: [],
    });
  });

  it('xc1(F): stores a positional pipe', () => {
    expect(paramMeta(RawBody(Pipe))).toEqual({
      index: 0,
      data: undefined,
      pipes: [Pipe],
    });
  });

  it('xc1(T): accepts an options object with pipes', () => {
    expect(paramMeta(RawBody({ schema, pipes: [Pipe] }))).toEqual({
      index: 0,
      data: undefined,
      pipes: [Pipe],
      schema,
    });
  });

  it('xc1(T): handles options without pipes', () => {
    expect(paramMeta(RawBody({ schema }))).toEqual({
      index: 0,
      data: undefined,
      pipes: [],
      schema,
    });
  });

  it('merges extra pipes after options', () => {
    expect(paramMeta(RawBody({ schema, pipes: [Pipe] }, pipeInstance))).toEqual({
      index: 0,
      data: undefined,
      pipes: [Pipe, pipeInstance],
      schema,
    });
  });

  it('filters falsy positional arguments', () => {
    expect(paramMeta(RawBody(null))).toEqual({
      index: 0,
      data: undefined,
      pipes: [],
    });
  });
});

describe('Cookies', () => {
  it('xc1(T), xc2(T): stores no data and no pipes by default', () => {
    expect(paramMeta(Cookies())).toEqual({
      index: 0,
      data: undefined,
      pipes: [],
    });
  });

  it('xc1(F), xc2(T): stores a string cookie name', () => {
    expect(paramMeta(Cookies('theme'))).toEqual({
      index: 0,
      data: 'theme',
      pipes: [],
    });
  });

  it('xc1(F), xc2(F): treats a pipe class as a pipe', () => {
    expect(paramMeta(Cookies(Pipe))).toEqual({
      index: 0,
      data: undefined,
      pipes: [Pipe],
    });
  });

  it('stores a cookie name with pipes', () => {
    expect(paramMeta(Cookies('theme', Pipe))).toEqual({
      index: 0,
      data: 'theme',
      pipes: [Pipe],
    });
  });
});

describe('SignedCookies', () => {
  it('stores a string cookie name', () => {
    expect(paramMeta(SignedCookies('uid'))).toEqual({
      index: 0,
      data: 'uid',
      pipes: [],
    });
  });

  it('treats a pipe class as a pipe', () => {
    expect(paramMeta(SignedCookies(Pipe))).toEqual({
      index: 0,
      data: undefined,
      pipes: [Pipe],
    });
  });
});
