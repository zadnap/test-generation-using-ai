import { Readable } from 'stream';
import { describe, expect, it, vi } from 'vitest';
import { StreamableFile } from '../../../../packages/common/file-stream/streamable-file.js';
import { destroyUnsentBody } from '../../../../packages/core/helpers/destroy-unsent-body.js';

describe('destroyUnsentBody', () => {
  it('xc1(T): cancels a streaming body', async () => {
    const cancel = vi.fn(async () => undefined);
    const body = {
      [Symbol.asyncIterator]: () => ({
        next: async () => ({ done: true, value: undefined }),
        return: cancel,
      }),
    };

    destroyUnsentBody(body);
    await Promise.resolve();

    expect(cancel).toHaveBeenCalled();
  });

  it('xc1(F), xc2(T): destroys the stream of a StreamableFile', () => {
    const stream = new Readable({ read: () => undefined });
    const destroy = vi.spyOn(stream, 'destroy');

    destroyUnsentBody(new StreamableFile(stream));

    expect(destroy).toHaveBeenCalled();
  });

  it('xc2(F): ignores values that are not StreamableFile instances', () => {
    expect(() => destroyUnsentBody({})).not.toThrow();
  });

  it('xc3(F): ignores a StreamableFile without a destroyable stream', () => {
    const file = new StreamableFile(Buffer.from('abc'));
    (file as any).stream = {};

    expect(() => destroyUnsentBody(file)).not.toThrow();
  });
});
