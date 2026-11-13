import { Readable, Writable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { of, throwError, lastValueFrom } from 'rxjs';
import { ExecutionContextHost } from '../../../../packages/core/helpers/execution-context-host.js';

export function multipartRequest(withFile: boolean): any {
  const boundary = 'nest-express-ai-fixture';
  const part = withFile
    ? 'Content-Disposition: form-data; name="upload"; filename="fixture.txt"\r\nContent-Type: text/plain\r\n\r\nvalue'
    : 'Content-Disposition: form-data; name="field"\r\n\r\nvalue';
  const body = Buffer.from(`--${boundary}\r\n${part}\r\n--${boundary}--\r\n`);
  return Object.assign(Readable.from([body]), {
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
      'content-length': String(body.length),
    },
    method: 'POST',
  });
}

export async function exerciseInterceptor(
  Interceptor: any,
  mode: string,
  registration: string,
) {
  const target: any = new Interceptor();
  const req: any =
    mode === 'multipart'
      ? multipartRequest(registration !== 'none')
      : Object.assign(Readable.from([]), { headers: {} });
  const res = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  if (mode === 'upload error') {
    target.multer[registration] =
      () => (_req: unknown, _res: unknown, callback: Function) =>
        callback(
          Object.assign(new Error('File too large'), {
            code: 'LIMIT_FILE_SIZE',
          }),
        );
  }
  if (mode === 'pipes rejected')
    req[Symbol.for('nestjs:rejected-by-pipes')] = true;
  const next = {
    handle: () =>
      mode === 'pipes rejected'
        ? throwError(() => new Error('pipes'))
        : of('value'),
  };
  try {
    const output = await target.intercept(
      new ExecutionContextHost([req, res]),
      next,
    );
    await lastValueFrom(output).catch(() => undefined);
  } catch (error) {
    if (mode !== 'upload error') throw error;
  } finally {
    res.end();
    await finished(res);
    req.destroy();
  }
}
