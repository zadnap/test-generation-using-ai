import { describe, expect, it, vi } from 'vitest';
import { Readable } from 'stream';
import { StreamableFile } from '../../../../packages/common/file-stream/streamable-file.js';
import { HttpStatus } from '../../../../packages/common/enums/index.js';
import { StreamableHandlerResponse } from '../../../../packages/common/file-stream/interfaces/index.js';

describe('StreamableFile (C3)', () => {
  describe('constructor', () => {
    describe('condition 1: types.isUint8Array(bufferOrReadStream)', () => {
      it.each([
        ['Buffer instance', Buffer.from('hello buffer')],
        ['Uint8Array instance', new Uint8Array([1, 2, 3, 4, 5])],
        ['empty Uint8Array', new Uint8Array([])],
      ])('branches to 1(T): wraps %s into Readable stream and pushes null', (_label, input) => {
        const streamable = new StreamableFile(input);
        const stream = streamable.getStream();

        expect(stream).toBeInstanceOf(Readable);
        const chunk = stream.read();
        expect(chunk).toBeDefined();
      });

      describe('nullish coalescing: options.length ?? bufferOrReadStream.length', () => {
        it.each([
          ['explicit length provided (1_sub: T)', { length: 999 }, 999],
          ['options.length undefined (1_sub: F)', {}, 5],
          ['default options omitted (1_sub: F)', undefined, 5],
        ])('resolves content length correctly when %s', (_label, options, expectedLength) => {
          const buffer = new Uint8Array([10, 20, 30, 40, 50]);
          const streamable = options
            ? new StreamableFile(buffer, options)
            : new StreamableFile(buffer);

          expect(streamable.getHeaders().length).toBe(expectedLength);
        });

        it('does not mutate shared options object when auto-populating length', () => {
          const sharedOptions = { type: 'text/plain' };
          const file1 = new StreamableFile(new Uint8Array([1, 2]), sharedOptions);
          const file2 = new StreamableFile(new Uint8Array([1, 2, 3, 4]), sharedOptions);

          expect(file1.getHeaders().length).toBe(2);
          expect(file2.getHeaders().length).toBe(4);
          expect(sharedOptions).toEqual({ type: 'text/plain' });
        });
      });
    });

    describe('condition 2: else if (bufferOrReadStream.pipe && isFunction(bufferOrReadStream.pipe)) [1: F]', () => {
      it('branches to 2(T) and 3(T): assigns stream and attaches error listener when on is a function', () => {
        const stream = new Readable({ read() {} });
        const onSpy = vi.spyOn(stream, 'on');

        const streamable = new StreamableFile(stream);

        expect(streamable.getStream()).toBe(stream);
        expect(onSpy).toHaveBeenCalledWith('error', expect.any(Function));
        // Verify attached error listener prevents unhandled error throw
        expect(() => stream.emit('error', new Error('stream error'))).not.toThrow();
      });

      it('branches to 2(T) and 3(F): assigns stream when pipe is a function but on is not a function', () => {
        const customStreamLike = {
          pipe: vi.fn(),
          on: 'not-a-function',
        };

        const streamable = new StreamableFile(customStreamLike as any);

        expect(streamable.getStream()).toBe(customStreamLike as any);
      });

      it('branches to 2(T) and 3(F): assigns stream when on property is absent', () => {
        const customStreamLike = {
          pipe: vi.fn(),
        };

        const streamable = new StreamableFile(customStreamLike as any);

        expect(streamable.getStream()).toBe(customStreamLike as any);
      });

      it('branches to 2c1(T) and 2c2(F): does not assign stream when pipe property is not a function', () => {
        const invalidObject = {
          pipe: 'not-a-function',
        };

        const streamable = new StreamableFile(invalidObject as any);

        expect(streamable.getStream()).toBeUndefined();
      });

      it.each([
        ['plain object without pipe', { notPipe: true }],
        ['empty object', {}],
        ['number primitive', 12345],
        ['string primitive', 'not-a-stream'],
        ['boolean primitive', true],
      ])('branches to 2c1(F): does not assign stream for non-pipe input %s', (_label, input) => {
        const streamable = new StreamableFile(input as any);
        expect(streamable.getStream()).toBeUndefined();
      });
    });
  });

  describe('getStream', () => {
    it.each([
      ['Uint8Array stream', () => new StreamableFile(new Uint8Array([1, 2]))],
      ['Readable stream', () => new StreamableFile(new Readable({ read() {} }))],
      ['Invalid input stream', () => new StreamableFile({} as any)],
    ])('returns the underlying stream for %s', (_label, factory) => {
      const streamable = factory();
      const stream = streamable.getStream();

      if (_label.includes('Invalid')) {
        expect(stream).toBeUndefined();
      } else {
        expect(stream).toBeDefined();
      }
    });
  });

  describe('getHeaders', () => {
    it.each([
      [
        'all defaults (type: application/octet-stream, disposition: undefined, length: undefined)',
        {},
        {
          type: 'application/octet-stream',
          disposition: undefined,
          length: undefined,
        },
      ],
      [
        'custom type only',
        { type: 'application/json' },
        {
          type: 'application/json',
          disposition: undefined,
          length: undefined,
        },
      ],
      [
        'custom disposition string and length',
        {
          type: 'text/csv',
          disposition: 'attachment; filename="data.csv"',
          length: 512,
        },
        {
          type: 'text/csv',
          disposition: 'attachment; filename="data.csv"',
          length: 512,
        },
      ],
      [
        'custom disposition string array',
        {
          disposition: ['attachment', 'filename="report.pdf"'],
        },
        {
          type: 'application/octet-stream',
          disposition: ['attachment', 'filename="report.pdf"'],
          length: undefined,
        },
      ],
    ])('returns headers for %s', (_label, options, expected) => {
      const stream = new Readable({ read() {} });
      const streamable = new StreamableFile(stream, options);

      expect(streamable.getHeaders()).toEqual(expected);
    });
  });

  describe('errorHandler & setErrorHandler', () => {
    it('returns the default error handler via getter', () => {
      const stream = new Readable({ read() {} });
      const streamable = new StreamableFile(stream);

      expect(streamable.errorHandler).toBeTypeOf('function');
    });

    it('sets a custom error handler and returns the instance for chaining', () => {
      const stream = new Readable({ read() {} });
      const streamable = new StreamableFile(stream);
      const customHandler = vi.fn();

      const returned = streamable.setErrorHandler(customHandler);

      expect(returned).toBe(streamable);
      expect(streamable.errorHandler).toBe(customHandler);
    });
  });

  describe('errorLogger & setErrorLogger', () => {
    it('returns the default error logger via getter', () => {
      const stream = new Readable({ read() {} });
      const streamable = new StreamableFile(stream);

      expect(streamable.errorLogger).toBeTypeOf('function');
    });

    it('sets a custom error logger and returns the instance for chaining', () => {
      const stream = new Readable({ read() {} });
      const streamable = new StreamableFile(stream);
      const customLogger = vi.fn();

      const returned = streamable.setErrorLogger(customLogger);

      expect(returned).toBe(streamable);
      expect(streamable.errorLogger).toBe(customLogger);
    });

    it('executes the default error logger calling logger.error', () => {
      const stream = new Readable({ read() {} });
      const streamable = new StreamableFile(stream);
      const loggerSpy = vi.spyOn((streamable as any).logger, 'error').mockImplementation(() => {});

      const testError = new Error('logger test error');
      streamable.errorLogger(testError);

      expect(loggerSpy).toHaveBeenCalledWith(testError);
      loggerSpy.mockRestore();
    });
  });

  describe('default handleError behavior (C3)', () => {
    describe('decision 1: res.destroyed', () => {
      it('branches to 1(T): early returns immediately when res.destroyed is true', () => {
        const stream = new Readable({ read() {} });
        const errorLogger = vi.fn();
        const streamable = new StreamableFile(stream).setErrorLogger(errorLogger);

        const res: StreamableHandlerResponse = {
          destroyed: true,
          headersSent: false,
          statusCode: 200,
          send: vi.fn(),
          end: vi.fn(),
          destroy: vi.fn(),
        };

        const error = new Error('destroyed test');
        streamable.errorHandler(error, res);

        expect(errorLogger).not.toHaveBeenCalled();
        expect(res.send).not.toHaveBeenCalled();
        expect(res.end).not.toHaveBeenCalled();
        expect(res.destroy).not.toHaveBeenCalled();
      });
    });

    describe('decision 2: res.headersSent [1: F]', () => {
      describe('headersSent is true [2: T]', () => {
        it('branches to 3c1(T) and 3c2(T): calls res.destroy() when stream has not ended', () => {
          const stream = new Readable({ read() {} });
          const errorLogger = vi.fn();
          const streamable = new StreamableFile(stream).setErrorLogger(errorLogger);

          const res: StreamableHandlerResponse = {
            destroyed: false,
            headersSent: true,
            statusCode: 200,
            send: vi.fn(),
            end: vi.fn(),
            destroy: vi.fn(),
          };

          const error = new Error('mid-stream I/O error');
          streamable.errorHandler(error, res);

          expect(errorLogger).toHaveBeenCalledWith(error);
          expect(res.destroy).toHaveBeenCalledOnce();
          expect(res.end).not.toHaveBeenCalled();
          expect(res.send).not.toHaveBeenCalled();
        });

        it('branches to 3c1(T) and 3c2(F): calls res.end() when stream has already ended', async () => {
          const stream = Readable.from(['complete payload']);
          stream.resume();
          await new Promise(resolve => stream.once('end', resolve));

          const errorLogger = vi.fn();
          const streamable = new StreamableFile(stream).setErrorLogger(errorLogger);

          const res: StreamableHandlerResponse = {
            destroyed: false,
            headersSent: true,
            statusCode: 200,
            send: vi.fn(),
            end: vi.fn(),
            destroy: vi.fn(),
          };

          const error = new Error('closing error after stream ended');
          streamable.errorHandler(error, res);

          expect(errorLogger).toHaveBeenCalledWith(error);
          expect(res.destroy).not.toHaveBeenCalled();
          expect(res.end).toHaveBeenCalledOnce();
          expect(res.send).not.toHaveBeenCalled();
        });

        it('branches to 3c1(F): calls res.end() when res.destroy is not a function', () => {
          const stream = new Readable({ read() {} });
          const errorLogger = vi.fn();
          const streamable = new StreamableFile(stream).setErrorLogger(errorLogger);

          const res: StreamableHandlerResponse = {
            destroyed: false,
            headersSent: true,
            statusCode: 200,
            send: vi.fn(),
            end: vi.fn(),
            destroy: undefined,
          };

          const error = new Error('no destroy function on response');
          streamable.errorHandler(error, res);

          expect(errorLogger).toHaveBeenCalledWith(error);
          expect(res.end).toHaveBeenCalledOnce();
          expect(res.send).not.toHaveBeenCalled();
        });

        it('branches to 3c1(T) and 3c2(T): calls res.destroy() when this.stream is undefined', () => {
          const errorLogger = vi.fn();
          const streamable = new StreamableFile({} as any).setErrorLogger(errorLogger);

          const res: StreamableHandlerResponse = {
            destroyed: false,
            headersSent: true,
            statusCode: 200,
            send: vi.fn(),
            end: vi.fn(),
            destroy: vi.fn(),
          };

          const error = new Error('stream undefined test');
          streamable.errorHandler(error, res);

          expect(errorLogger).toHaveBeenCalledWith(error);
          expect(res.destroy).toHaveBeenCalledOnce();
          expect(res.end).not.toHaveBeenCalled();
        });
      });

      describe('headersSent is false [2: F]', () => {
        it.each([
          ['ENOENT file not found error', new Error("ENOENT: no such file '/var/test.png'")],
          ['EACCES permission error', new Error("EACCES: permission denied")],
          ['generic Error', new Error("Generic failure")],
        ])('branches to 2(F): logs error and responds with BAD_REQUEST for %s', (_label, error) => {
          const stream = new Readable({ read() {} });
          const errorLogger = vi.fn();
          const streamable = new StreamableFile(stream).setErrorLogger(errorLogger);

          const res: StreamableHandlerResponse = {
            destroyed: false,
            headersSent: false,
            statusCode: 200,
            send: vi.fn(),
            end: vi.fn(),
            destroy: vi.fn(),
          };

          streamable.errorHandler(error, res);

          expect(errorLogger).toHaveBeenCalledWith(error);
          expect(res.statusCode).toBe(HttpStatus.BAD_REQUEST);
          expect(res.send).toHaveBeenCalledWith('Bad Request');
          expect(res.end).not.toHaveBeenCalled();
          expect(res.destroy).not.toHaveBeenCalled();
        });
      });
    });
  });
});
