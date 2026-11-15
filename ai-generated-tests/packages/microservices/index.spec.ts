import { describe, expect, it } from 'vitest';
import * as MicroservicesIndex from '../../../packages/microservices/index.js';
import '../../../packages/microservices/serializers/index.js';
import '../../../packages/microservices/external/rmq-url.interface.js';
import '../../../packages/microservices/interfaces/microservice-entrypoint-metadata.interface.js';
import '../../../packages/microservices/external/redis.interface.js';

describe('Microservices Barrel Exports', () => {
  it('should export all public API', () => {
    expect(MicroservicesIndex.Transport).toBeDefined();
    expect(MicroservicesIndex.ClientProxy).toBeDefined();
  });
});
