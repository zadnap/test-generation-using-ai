import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { StreamableFile } from '../../../../packages/common/file-stream/streamable-file.js';
import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';

const response = () => ({
  destroyed: false,
  headersSent: false,
  statusCode: 0,
  send: vi.fn(),
  destroy: vi.fn(),
  end: vi.fn(),
});

describe('StreamableFile', () => {
  it('wraps a buffer in a readable stream and infers its length', async () => {
    const file = new StreamableFile(Buffer.from('hello'));
    expect(file.getStream()).toBeInstanceOf(Readable);
    expect(file.getHeaders().length).toBe(5);
    const chunks: Buffer[] = [];
    for await (const chunk of file.getStream()) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks).toString()).toBe('hello');
  });

  it('accepts an explicit length overriding the buffer length', () => {
    const file = new StreamableFile(Buffer.from('hello'), { length: 2 });
    expect(file.getHeaders().length).toBe(2);
  });

  it('wraps a readable stream and attaches an error listener', () => {
    const readable = new Readable({ read() {} });
    const on = vi.spyOn(readable, 'on');
    const file = new StreamableFile(readable);
    expect(file.getStream()).toBe(readable);
    expect(on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it.each([
    ['defaults', {}, { type: 'application/octet-stream', disposition: undefined, length: 3 }],
    ['all options', { type: 'text/plain', disposition: 'inline', length: 3 }, { type: 'text/plain', disposition: 'inline', length: 3 }],
  ])('builds headers with %s', (_label, options, expected) => {
    expect(new StreamableFile(Buffer.from('abc'), options).getHeaders()).toEqual(
      expected,
    );
  });

  describe('error handling', () => {
    it('does nothing for a destroyed response', () => {
      const file = new StreamableFile(Buffer.from('x'));
      const res: any = response();
      res.destroyed = true;
      const logError = vi.fn();
      file.setErrorLogger(logError);
      file.errorHandler(new Error('x'), res);
      expect(logError).not.toHaveBeenCalled();
      expect(res.send).not.toHaveBeenCalled();
    });

    it('destroys a response when headers were sent and the stream ended', () => {
      const file = new StreamableFile(Buffer.from('x'));
      const res: any = response();
      res.headersSent = true;
      const logError = vi.fn();
      file.setErrorLogger(logError);
      file.errorHandler(new Error('x'), res);
      expect(res.destroy).toHaveBeenCalled();
      expect(res.end).not.toHaveBeenCalled();
      expect(logError).toHaveBeenCalled();
    });

    it('ends a response when the stream already ended', () => {
      const file = new StreamableFile(Buffer.from('x'));
      const res: any = response();
      res.headersSent = true;
      (file as any).stream = { ...(file as any).stream, readableEnded: true };
      file.errorHandler(new Error('x'), res);
      expect(res.end).toHaveBeenCalled();
      expect(res.destroy).not.toHaveBeenCalled();
    });

    it('ends a response when it cannot be destroyed', () => {
      const file = new StreamableFile(Buffer.from('x'));
      const res: any = response();
      res.headersSent = true;
      res.destroy = undefined;
      file.errorHandler(new Error('x'), res);
      expect(res.end).toHaveBeenCalled();
    });

    it('sends a bad request when headers were not sent', () => {
      const file = new StreamableFile(Buffer.from('x'));
      const res: any = response();
      const logError = vi.fn();
      file.setErrorLogger(logError);
      file.errorHandler(new Error('secret path'), res);
      expect(res.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(res.send).toHaveBeenCalledWith('Bad Request');
      expect(logError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  it('allows replacing the error handler and logger fluently', () => {
    const file = new StreamableFile(Buffer.from('x'));
    const handler = vi.fn();
    const logger = vi.fn();
    expect(file.setErrorHandler(handler)).toBe(file);
    expect(file.setErrorLogger(logger)).toBe(file);
    expect(file.errorHandler).toBe(handler);
    expect(file.errorLogger).toBe(logger);
  });

  it('logs through the default logger', () => {
    const file: any = new StreamableFile(Buffer.from('x'));
    const error = vi.spyOn(file.logger, 'error').mockImplementation(() => {});
    file.errorLogger(new Error('x'));
    expect(error).toHaveBeenCalled();
  });
});
