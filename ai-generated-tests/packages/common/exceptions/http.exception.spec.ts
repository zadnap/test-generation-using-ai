import { describe, expect, it } from 'vitest';
import { HttpException } from '../../../../packages/common/exceptions/http.exception.js';

describe('HttpException', () => {
  it('uses a string response as the message and copies the status', () => {
    const error = new HttpException('My error', 404);

    expect(error.getResponse()).toBe('My error');
    expect(error.getStatus()).toBe(404);
    expect(error.message).toBe('My error');
    expect(error.name).toBe('HttpException');
    expect(error.cause).toBeUndefined();
    expect(error.errorCode).toBeUndefined();
  });

  it('uses a string message from an object response', () => {
    expect(new HttpException({ message: 'custom message' }, 400).message).toBe(
      'custom message',
    );
  });

  it('derives a message from the constructor name for object and primitive responses', () => {
    expect(new HttpException({ foo: 'bar' }, 400).message).toBe(
      'Http Exception',
    );
    expect(new HttpException(42 as any, 400).message).toBe('Http Exception');
    expect(new HttpException(null as any, 400).message).toBe('Http Exception');
  });

  it('falls back to Error when the constructor name has no word parts', () => {
    class lowercase extends HttpException {}
    expect(new lowercase({}, 400).message).toBe('Error');
  });

  it('skips message derivation when the constructor is unavailable', () => {
    const target: any = { response: 42, constructor: null };
    HttpException.prototype.initMessage.call(target);
    expect(target.message).toBeUndefined();
  });

  it('copies truthy causes and ignores falsy causes', () => {
    const cause = new Error('root cause');

    expect(new HttpException('msg', 400, { cause }).cause).toBe(cause);
    expect(new HttpException('msg', 400, { cause: null }).cause).toBeUndefined();
    expect(new HttpException('msg', 400, { cause: 0 }).cause).toBeUndefined();
    expect(new HttpException('msg', 400, {}).cause).toBeUndefined();
    expect(new HttpException('msg', 400).cause).toBeUndefined();
  });

  it('copies truthy error codes and ignores falsy error codes', () => {
    expect(
      new HttpException('msg', 400, { errorCode: 'E' }).errorCode,
    ).toBe('E');
    expect(
      new HttpException('msg', 400, { errorCode: '' }).errorCode,
    ).toBeUndefined();
    expect(new HttpException('msg', 400, {}).errorCode).toBeUndefined();
    expect(new HttpException('msg', 400).errorCode).toBeUndefined();
  });

  it('builds a body from a nil message with and without an error code', () => {
    expect(HttpException.createBody(null, 'error', 500)).toEqual({
      message: 'error',
      statusCode: 500,
    });
    expect(HttpException.createBody('', 'error', 500)).toEqual({
      message: 'error',
      statusCode: 500,
    });
    expect(HttpException.createBody(null, 'error', 500, 'E')).toEqual({
      message: 'error',
      statusCode: 500,
      errorCode: 'E',
    });
  });

  it('builds a body from a string message with and without an error code', () => {
    expect(HttpException.createBody('message', 'error', 400)).toEqual({
      message: 'message',
      error: 'error',
      statusCode: 400,
    });
    expect(
      HttpException.createBody('message', 'error', 400, 'E'),
    ).toEqual({
      message: 'message',
      error: 'error',
      statusCode: 400,
      errorCode: 'E',
    });
  });

  it('builds a body from array and number messages', () => {
    expect(
      HttpException.createBody(['a', 'b'], 'error', 200),
    ).toEqual({
      message: ['a', 'b'],
      error: 'error',
      statusCode: 200,
    });
    expect(HttpException.createBody(404, 'error', 404)).toEqual({
      message: 404,
      error: 'error',
      statusCode: 404,
    });
    expect(HttpException.createBody(0, 'error', 400)).toEqual({
      message: 'error',
      statusCode: 400,
    });
  });

  it('returns a custom object body as-is', () => {
    const body = { message: 'test' };
    expect(HttpException.createBody(body)).toBe(body);
  });

  it('extracts descriptions from strings, options, and nullish values', () => {
    expect(HttpException.getDescriptionFrom('desc')).toBe('desc');
    expect(
      HttpException.getDescriptionFrom({ description: 'from-options' }),
    ).toBe('from-options');
    expect(HttpException.getDescriptionFrom({})).toBeUndefined();
    expect(HttpException.getDescriptionFrom(null as any)).toBeUndefined();
  });

  it('extracts options from strings, objects, and nullish values', () => {
    expect(HttpException.getHttpExceptionOptionsFrom('desc')).toEqual({});
    const options = { cause: new Error('cause'), description: 'desc' };
    expect(HttpException.getHttpExceptionOptionsFrom(options)).toBe(options);
    expect(HttpException.getHttpExceptionOptionsFrom(null as any)).toBeNull();
  });

  it('extracts both description and options', () => {
    expect(
      HttpException.extractDescriptionAndOptionsFrom('description'),
    ).toEqual({ description: 'description', httpExceptionOptions: {} });

    const options = { description: 'from obj', cause: new Error() };
    expect(HttpException.extractDescriptionAndOptionsFrom(options)).toEqual({
      description: 'from obj',
      httpExceptionOptions: options,
    });

    expect(HttpException.extractDescriptionAndOptionsFrom({})).toEqual({
      description: undefined,
      httpExceptionOptions: {},
    });

    expect(
      HttpException.extractDescriptionAndOptionsFrom(null as any),
    ).toEqual({
      description: undefined,
      httpExceptionOptions: null,
    });
  });
});
