import {
  METHOD_METADATA,
  PATH_METADATA,
} from '../../../../../packages/common/constants.js';
import {
  All,
  Copy,
  Delete,
  Get,
  Head,
  Lock,
  Mkcol,
  Move,
  Options,
  Patch,
  Post,
  Propfind,
  Proppatch,
  Put,
  QueryMethod,
  RequestMapping,
  Search,
  Unlock,
} from '../../../../../packages/common/decorators/http/request-mapping.decorator.js';
import { RequestMethod } from '../../../../../packages/common/enums/request-method.enum.js';

function descriptorFor(target: any, key: string) {
  return Object.getOwnPropertyDescriptor(target, key)!;
}

describe('RequestMapping', () => {
  it('uses root path and GET by default', () => {
    class Target {
      method() {}
    }
    const descriptor = descriptorFor(Target.prototype, 'method');

    expect(RequestMapping()(Target.prototype, 'method', descriptor)).toBe(
      descriptor,
    );
    expect(Reflect.getMetadata(PATH_METADATA, descriptor.value)).toBe('/');
    expect(Reflect.getMetadata(METHOD_METADATA, descriptor.value)).toBe(
      RequestMethod.GET,
    );
  });

  it('falls back to root for empty paths and GET for a falsy method', () => {
    class Target {
      emptyString() {}
      emptyArray() {}
      falsyMethod() {}
    }
    const emptyString = descriptorFor(Target.prototype, 'emptyString');
    const emptyArray = descriptorFor(Target.prototype, 'emptyArray');
    const falsyMethod = descriptorFor(Target.prototype, 'falsyMethod');

    RequestMapping({ path: '' })(Target.prototype, 'emptyString', emptyString);
    RequestMapping({ path: [] })(Target.prototype, 'emptyArray', emptyArray);
    RequestMapping({ path: 'x', method: RequestMethod.GET })(
      Target.prototype,
      'falsyMethod',
      falsyMethod,
    );

    expect(Reflect.getMetadata(PATH_METADATA, emptyString.value)).toBe('/');
    expect(Reflect.getMetadata(PATH_METADATA, emptyArray.value)).toBe('/');
    expect(Reflect.getMetadata(METHOD_METADATA, falsyMethod.value)).toBe(
      RequestMethod.GET,
    );
  });

  it('keeps explicit path arrays and request methods', () => {
    class Target {
      method() {}
    }
    const descriptor = descriptorFor(Target.prototype, 'method');

    RequestMapping({
      path: ['a', 'b'],
      method: RequestMethod.PATCH,
    })(Target.prototype, 'method', descriptor);

    expect(Reflect.getMetadata(PATH_METADATA, descriptor.value)).toEqual([
      'a',
      'b',
    ]);
    expect(Reflect.getMetadata(METHOD_METADATA, descriptor.value)).toBe(
      RequestMethod.PATCH,
    );
  });

  it.each([
    [Post, RequestMethod.POST],
    [Get, RequestMethod.GET],
    [Delete, RequestMethod.DELETE],
    [Put, RequestMethod.PUT],
    [Patch, RequestMethod.PATCH],
    [Options, RequestMethod.OPTIONS],
    [Head, RequestMethod.HEAD],
    [All, RequestMethod.ALL],
    [Search, RequestMethod.SEARCH],
    [QueryMethod, RequestMethod.QUERY],
    [Propfind, RequestMethod.PROPFIND],
    [Proppatch, RequestMethod.PROPPATCH],
    [Mkcol, RequestMethod.MKCOL],
    [Copy, RequestMethod.COPY],
    [Move, RequestMethod.MOVE],
    [Lock, RequestMethod.LOCK],
    [Unlock, RequestMethod.UNLOCK],
  ])('maps %# to the expected request method', (decorator, method) => {
    class Target {
      method() {}
    }
    const descriptor = descriptorFor(Target.prototype, 'method');

    (decorator as any)('path')(Target.prototype, 'method', descriptor);

    expect(Reflect.getMetadata(PATH_METADATA, descriptor.value)).toBe('path');
    expect(Reflect.getMetadata(METHOD_METADATA, descriptor.value)).toBe(
      method,
    );
  });
});
