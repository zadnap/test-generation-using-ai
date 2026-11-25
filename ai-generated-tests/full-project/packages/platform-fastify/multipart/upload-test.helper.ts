import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import { PassThrough, Readable } from 'stream';
import { of } from 'rxjs';

export type AnyPart = Record<string, any>;

export const uploadFilePart = (
  fieldname: string,
  content = 'data',
  filename = `${fieldname}.txt`,
): AnyPart => {
  const stream = Readable.from([Buffer.from(content)]) as any;
  stream.truncated = false;
  stream.on('error', () => undefined);
  return {
    type: 'file',
    fieldname,
    filename,
    encoding: '7bit',
    mimetype: 'text/plain',
    file: stream,
  };
};

export const uploadFieldPart = (
  fieldname: string,
  value: string,
): AnyPart => ({
  type: 'field',
  fieldname,
  value,
  encoding: '7bit',
  mimetype: 'text/plain',
});

export const createUploadRequest = (parts: AnyPart[] = []) => {
  const raw = new PassThrough() as any;
  raw.unpipe = () => undefined;
  raw.end();
  const req: any = { raw, isMultipart: () => true };
  req.parts = () =>
    (async function* () {
      for (const part of parts) yield part;
    })();
  return req;
};

export const createUploadContext = (req: any, reply: any = {}) =>
  new ExecutionContextHost([req, reply]);

export const uploadReply = () => {
  const raw = new PassThrough() as any;
  raw.end();
  return { raw };
};

export const uploadNext = (value: any = 'ok') => ({
  handle: () => of(value),
});
