import { Readable } from 'stream';
import { describe, expect, it } from 'vitest';
import { memoryStorage } from '../../../../../packages/platform-fastify/multipart/storage/memory.storage.js';

// memoryStorage: callbacks only, no decision nodes in the module itself.
const incoming = (content: string | Buffer) =>
  ({
    fieldname: 'f',
    originalname: 'a.txt',
    encoding: '7bit',
    mimetype: 'text/plain',
    stream: Readable.from([Buffer.from(content)]),
  }) as any;

const handle = (storage: ReturnType<typeof memoryStorage>, file: any) =>
  new Promise<any>((resolve, reject) =>
    storage._handleFile({}, file, (err, info) => (err ? reject(err) : resolve(info))),
  );

describe('memoryStorage', () => {
  it('should buffer the file', async () => {
    const info = await handle(memoryStorage(), incoming('hello'));
    expect(info).toEqual({ buffer: Buffer.from('hello'), size: 5 });
  });

  it('should buffer an empty file', async () => {
    const info = await handle(memoryStorage(), incoming(''));
    expect(info).toEqual({ buffer: Buffer.alloc(0), size: 0 });
  });

  it('should concatenate multiple chunks', async () => {
    const file = incoming('');
    file.stream = Readable.from([Buffer.from('ab'), Buffer.from('cd')]);
    const info = await handle(memoryStorage(), file);
    expect(info.buffer.toString()).toBe('abcd');
    expect(info.size).toBe(4);
  });

  it('should report stream errors', async () => {
    const file = incoming('');
    file.stream = new Readable({
      read() {
        this.destroy(new Error('boom'));
      },
    });
    await expect(handle(memoryStorage(), file)).rejects.toThrow('boom');
  });

  it('should stop listening to the stream once the file is buffered', async () => {
    const file = incoming('hello');
    await handle(memoryStorage(), file);
    expect(file.stream.listenerCount('data')).toBe(0);
    expect(file.stream.listenerCount('end')).toBe(0);
    expect(file.stream.listenerCount('error')).toBe(0);
  });

  it('should stop listening to the stream once it fails', async () => {
    const file = incoming('');
    file.stream = new Readable({
      read() {
        this.push('partial');
        this.destroy(new Error('boom'));
      },
    });
    await expect(handle(memoryStorage(), file)).rejects.toThrow('boom');
    expect(file.stream.listenerCount('data')).toBe(0);
    expect(file.stream.listenerCount('end')).toBe(0);
    expect(file.stream.listenerCount('error')).toBe(0);
  });

  it('should drop the buffer on removal', async () => {
    const file: any = { buffer: Buffer.from('x') };
    await new Promise<void>(resolve =>
      memoryStorage()._removeFile({}, file, () => resolve()),
    );
    expect(file.buffer).toBeUndefined();
  });

  it('should call the removal callback without an error', async () => {
    const callback = vi.fn();
    memoryStorage()._removeFile({}, { buffer: Buffer.from('x') } as any, callback);
    expect(callback).toHaveBeenCalledWith(null);
  });
});
