import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FIELD_NAME_LIMITS,
  busboyExceptions,
  fastifyBusboyMessages,
  fastifyMultipartBadRequestCodes,
  fastifyMultipartErrorCodes,
  MISSING_PLUGIN_MESSAGE,
  multerExceptions,
  PLUGIN_NOT_REGISTERED_AT_STARTUP_MESSAGE,
  WRONG_ADAPTER_MESSAGE,
} from '../../../../../packages/platform-fastify/multipart/multipart/multipart.constants.js';

// multipart.constants.ts has no decision nodes: 1 independent path.
describe('multipart constants', () => {
  it.each(Object.entries(multerExceptions))(
    'should expose the multer message for %s',
    (_code, message) => {
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    },
  );

  it('should expose the field-name defaults', () => {
    expect(DEFAULT_FIELD_NAME_LIMITS).toEqual({
      fieldNestingDepth: 32,
      fieldArrayIndexLimit: 1000,
    });
  });

  it.each(Object.entries(busboyExceptions))(
    'should expose the platform-express busboy message %s',
    (_name, message) => {
      expect(message).toMatch(/^Multipart: /);
    },
  );

  it.each(Object.entries(fastifyBusboyMessages))(
    'should expose the @fastify/busboy message %s',
    (_name, message) => {
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    },
  );

  it('should map fastify multipart error codes to multer codes', () => {
    expect(fastifyMultipartErrorCodes).toMatchObject({
      FST_PARTS_LIMIT: 'LIMIT_PART_COUNT',
      FST_FILES_LIMIT: 'LIMIT_FILE_COUNT',
      FST_FIELDS_LIMIT: 'LIMIT_FIELD_COUNT',
      FST_REQ_FILE_TOO_LARGE: 'LIMIT_FILE_SIZE',
      FST_PROTO_VIOLATION: 'INVALID_FIELD_NAME',
    });
  });

  it('should list the bad-request fastify codes', () => {
    expect(fastifyMultipartBadRequestCodes).toEqual([
      'FST_MP_PREMATURE_CLOSE',
      'FST_INVALID_JSON_FIELD_ERROR',
    ]);
  });

  it.each([
    [MISSING_PLUGIN_MESSAGE, /@fastify\/multipart/],
    [PLUGIN_NOT_REGISTERED_AT_STARTUP_MESSAGE, /not registered before/],
    [WRONG_ADAPTER_MESSAGE, /FastifyAdapter/],
  ])('should expose a help message %s', (message, pattern) => {
    expect(message).toMatch(pattern);
  });
});
