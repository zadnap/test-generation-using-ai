import { EventEmitter } from 'node:events';
import { Writable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';

const state: { stream: any } = { stream: undefined };

vi.mock('send', () => ({
  default: vi.fn(() => state.stream),
}));

import { NodeResponse } from '../../../../packages/platform-node/adapters/node-request.js';

// A response that on-finished treats as an unfinished outgoing message: a
// Writable with a live socket it can listen to for errors.
function createResponse() {
  const headers = new Map<string, any>();
  const res: any = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  res.statusCode = 200;
  res.headersSent = false;
  res.setHeader = vi.fn((name: string, value: any) => {
    headers.set(name.toLowerCase(), value);
  });
  res.getHeader = vi.fn((name: string) => headers.get(name.toLowerCase()));
  res.hasHeader = vi.fn((name: string) => headers.has(name.toLowerCase()));
  res.removeHeader = vi.fn();
  res.destroy = vi.fn();
  res.socket = Object.assign(new EventEmitter(), {
    writable: true,
    server: {},
  });
  res.req = { headers: {}, method: 'GET', socket: res.socket };
  return res;
}

function createFile() {
  const file: any = new EventEmitter();
  file.pipe = vi.fn();
  return file;
}

function sendFileOn(
  res: any,
  file: any,
  options?: any,
  callback?: (err?: Error) => void,
) {
  state.stream = file;
  return NodeResponse.prototype.sendFile.call(
    res,
    '/absolute/file.txt',
    options,
    callback,
  );
}

const flushImmediates = () => new Promise(resolve => setImmediate(resolve));

// MC/DC for transferFile(): aborted writes ignored T/F; a repeated finish T/F;
// on-finished error ECONNRESET T/F; another error T/F; streamed file T/F;
// respondWithError: headersSent T/F, status range T/F
describe('NodeResponse sendFile transfer bookkeeping', () => {
  it('should ignore an aborted transfer when there is no callback', () => {
    const res = createResponse();
    const file = createFile();
    sendFileOn(res, file);
    file.emit(
      'error',
      Object.assign(new Error('aborted'), { code: 'ECONNABORTED' }),
    );
    expect(res.statusCode).toBe(200);
  });

  it('should ignore a write error when there is no callback', () => {
    const res = createResponse();
    const file = createFile();
    sendFileOn(res, file);
    file.emit('error', Object.assign(new Error('write'), { syscall: 'write' }));
    expect(res.statusCode).toBe(200);
  });

  it('should call the callback only once when the stream fails twice', () => {
    const res = createResponse();
    const file = createFile();
    const done = vi.fn();
    sendFileOn(res, file, undefined, done);
    file.emit('end');
    file.emit('error', new Error('late'));
    expect(done).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledWith(undefined);
  });

  it('should answer an unknown stream error without a status with a 500', async () => {
    const res = createResponse();
    const file = createFile();
    sendFileOn(res, file);
    res.socket.emit('error', Object.assign(new Error('pipe'), { code: 'EPIPE' }));
    await flushImmediates();
    expect(res.statusCode).toBe(500);
  });

  it('should answer an error with an out of range status with a 500', async () => {
    const res = createResponse();
    const file = createFile();
    sendFileOn(res, file);
    file.emit('error', Object.assign(new Error('big'), { status: 700 }));
    await flushImmediates();
    expect(res.statusCode).toBe(500);
  });

  it('should destroy a response whose headers were already sent', async () => {
    const res = createResponse();
    res.headersSent = true;
    const file = createFile();
    sendFileOn(res, file);
    file.emit('error', Object.assign(new Error('nope'), { status: 404 }));
    await flushImmediates();
    expect(res.destroy).toHaveBeenCalled();
  });

  it('should report an abort when the response finished before the file', async () => {
    const res = createResponse();
    const file = createFile();
    const done = vi.fn();
    sendFileOn(res, file, undefined, done);
    res.emit('finish');
    await flushImmediates();
    expect(done).toHaveBeenCalledTimes(1);
    expect(done.mock.calls[0][0]).toMatchObject({ code: 'ECONNABORTED' });
  });

  it('should not abort when the file ended before the deferred check', async () => {
    const res = createResponse();
    const file = createFile();
    const done = vi.fn();
    sendFileOn(res, file, undefined, done);
    res.emit('finish');
    file.emit('end');
    await flushImmediates();
    expect(done).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledWith(undefined);
  });

  it('should finish normally when the file was streamed first', async () => {
    const res = createResponse();
    const file = createFile();
    const done = vi.fn();
    sendFileOn(res, file, undefined, done);
    file.emit('file');
    res.emit('finish');
    await flushImmediates();
    expect(done).toHaveBeenCalledWith(undefined);
  });
});

describe('NodeResponse redirect content negotiation', () => {
  function redirectWith(accept: string) {
    const res = createResponse();
    res.req = { headers: { accept }, method: 'GET', socket: res.socket };
    NodeResponse.prototype.redirect.call(res, '/next');
    return res;
  }

  it('should not treat an unknown wildcard subtype as any type', () => {
    const res = redirectWith('*/json, text/html');
    expect(res.getHeader('Content-Type')).toBe('text/html; charset=utf-8');
  });

  it('should drop a text range with quality zero', () => {
    const res = redirectWith('text/plain;q=0, text/html');
    expect(res.getHeader('Content-Type')).toBe('text/html; charset=utf-8');
  });

  it('should sort by the more specific type when qualities are equal', () => {
    const res = redirectWith('text/*, text/html');
    expect(res.getHeader('Content-Type')).toBe('text/html; charset=utf-8');
  });
});
