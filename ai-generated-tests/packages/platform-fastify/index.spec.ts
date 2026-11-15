import { describe, expect, it } from 'vitest';
import * as FastifyIndex from '../../../packages/platform-fastify/index.js';
import '../../../packages/platform-fastify/adapters/index.js';
import '../../../packages/platform-fastify/decorators/index.js';
import '../../../packages/platform-fastify/interfaces/index.js';
import '../../../packages/platform-fastify/interfaces/external/index.js';
import '../../../packages/platform-fastify/interfaces/external/fastify-static-options.interface.js';
import '../../../packages/platform-fastify/interfaces/nest-fastify-application.interface.js';
import '../../../packages/platform-fastify/multipart/index.js';
import '../../../packages/platform-fastify/multipart/interceptors/index.js';
import '../../../packages/platform-fastify/multipart/interfaces/index.js';
import '../../../packages/platform-fastify/multipart/storage/index.js';

describe('Platform Fastify Barrel Exports', () => {
  it('should export all public API', () => {
    expect(FastifyIndex.FastifyAdapter).toBeDefined();
  });
});
