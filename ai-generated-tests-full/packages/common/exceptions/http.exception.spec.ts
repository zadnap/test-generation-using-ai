import { describe, expect, it } from 'vitest';
import { HttpException } from '../../../../packages/common/exceptions/http.exception.js';

describe('HttpException', () => {
  it('xc1(T): uses a string response as the message', () => {
    const exception = new HttpException('failure', 400);

    expect(exception.getResponse()).toBe('failure');
    expect(exception.getStatus()).toBe(400);
    expect(exception.message).toBe('failure');
    expect(exception.name).toBe('HttpException');
    expect(exception.cause).toBeUndefined();
    expect(exception.errorCode).toBeUndefined();
  });

  it('xc1(F), xc2(T): reads the message from an object response', () => {
    const exception = new HttpException({ message: 'object failure' }, 422);

    expect(exception.message).toBe('object failure');
  });

  it('xc2(F): derives the message from the class name for an object without a string message', () => {
    const exception = new HttpException({ message: 1 } as any, 500);

    expect(exception.message).toBe('Http Exception');
  });

  it('xc1(F), xc2(F): derives the message from the class name for a non-object response', () => {
    const exception = new HttpException(42 as any, 500);

    expect(exception.message).toBe('Http Exception');
  });

  it('derives the message from the class name for an empty object', () => {
    const exception = new HttpException({}, 500);

    expect(exception.message).toBe('Http Exception');
  });

  it('xc3(T): copies a truthy cause from the options', () => {
    const cause = new Error('root');

    const exception = new HttpException('failure', 400, { cause });

    expect(exception.cause).toBe(cause);
  });

  it('xc3(F): ignores a falsy cause', () => {
    const exception = new HttpException('failure', 400, { cause: 0 });

    expect(exception.cause).toBeUndefined();
  });

  it('xc4(T): copies a truthy error code from the options', () => {
    const exception = new HttpException('failure', 400, {
      errorCode: 'E_CODE',
    });

    expect(exception.errorCode).toBe('E_CODE');
  });

  it('xc4(F): ignores a falsy error code', () => {
    const exception = new HttpException('failure', 400, { errorCode: '' });

    expect(exception.errorCode).toBeUndefined();
  });
});

describe('HttpException.createBody', () => {
  it('xc1(T), xc2(F): builds a body when the first argument is falsy', () => {
    expect(HttpException.createBody(null as any, 'message', 400)).toEqual({
      message: 'message',
      statusCode: 400,
    });
  });

  it('xc1(T), xc2(T): adds an error code when provided', () => {
    expect(HttpException.createBody('' as any, 'message', 400, 'E')).toEqual({
      message: 'message',
      statusCode: 400,
      errorCode: 'E',
    });
  });

  it('xc1(F), xc3(T): builds a body from a string message', () => {
    expect(HttpException.createBody('message', 'error', 400)).toEqual({
      message: 'message',
      error: 'error',
      statusCode: 400,
    });
  });

  it('xc3(F), xc4(T): builds a body from an array message', () => {
    expect(
      HttpException.createBody(['a', 'b'] as any, 'error', 400, 'E'),
    ).toEqual({
      message: ['a', 'b'],
      error: 'error',
      statusCode: 400,
      errorCode: 'E',
    });
  });

  it('xc4(F), xc5(T): builds a body from a numeric message', () => {
    expect(HttpException.createBody(42 as any, 'error', 400)).toEqual({
      message: 42,
      error: 'error',
      statusCode: 400,
    });
  });

  it('xc5(F): returns a custom object body unchanged', () => {
    const body = { custom: true };

    expect(HttpException.createBody(body)).toBe(body);
  });
});

describe('HttpException static helpers', () => {
  it('xc1(T): getDescriptionFrom returns a string description', () => {
    expect(HttpException.getDescriptionFrom('description')).toBe(
      'description',
    );
  });

  it('xc1(F), xc2(T): getDescriptionFrom reads the description property', () => {
    expect(HttpException.getDescriptionFrom({ description: 'd' })).toBe('d');
  });

  it('xc2(F): getDescriptionFrom returns undefined without a description', () => {
    expect(HttpException.getDescriptionFrom({})).toBeUndefined();
  });

  it('xc1(T): getHttpExceptionOptionsFrom returns an empty object for a string', () => {
    expect(HttpException.getHttpExceptionOptionsFrom('description')).toEqual(
      {},
    );
  });

  it('xc1(F): getHttpExceptionOptionsFrom returns the options object', () => {
    const options = { description: 'd' };
    expect(HttpException.getHttpExceptionOptionsFrom(options)).toBe(options);
  });

  it('xc1(T): extractDescriptionAndOptionsFrom handles a string', () => {
    expect(HttpException.extractDescriptionAndOptionsFrom('d')).toEqual({
      description: 'd',
      httpExceptionOptions: {},
    });
  });

  it('xc1(F), xc2(T): extractDescriptionAndOptionsFrom handles options', () => {
    const options = { description: 'd', cause: 'c' };

    expect(HttpException.extractDescriptionAndOptionsFrom(options)).toEqual({
      description: 'd',
      httpExceptionOptions: options,
    });
  });

  it('xc2(F): extractDescriptionAndOptionsFrom handles missing options', () => {
    expect(
      HttpException.extractDescriptionAndOptionsFrom(undefined as any),
    ).toEqual({
      description: undefined,
      httpExceptionOptions: undefined,
    });
  });
});
