import { describe, expect, it } from 'vitest';
import {
  FASTIFY_ROUTE_CONFIG_METADATA,
  FASTIFY_ROUTE_CONSTRAINTS_METADATA,
  FASTIFY_ROUTE_SCHEMA_METADATA,
} from '../../../packages/platform-fastify/constants.js';

// constants.ts: 0 decision node, 1 independent path.
describe('platform-fastify constants', () => {
  it.each([
    ['FASTIFY_ROUTE_CONFIG_METADATA', FASTIFY_ROUTE_CONFIG_METADATA, '__fastify_route_config__'],
    ['FASTIFY_ROUTE_CONSTRAINTS_METADATA', FASTIFY_ROUTE_CONSTRAINTS_METADATA, '__fastify_route_constraints__'],
    ['FASTIFY_ROUTE_SCHEMA_METADATA', FASTIFY_ROUTE_SCHEMA_METADATA, '__fastify_route_schema__'],
  ])('should expose %s with its stable metadata key', (_, actual, expected) => {
    expect(typeof actual).toBe('string');
    expect(actual).toBe(expected);
  });

  it('should keep every metadata key distinct', () => {
    expect(
      new Set([
        FASTIFY_ROUTE_CONFIG_METADATA,
        FASTIFY_ROUTE_CONSTRAINTS_METADATA,
        FASTIFY_ROUTE_SCHEMA_METADATA,
      ]).size,
    ).toBe(3);
  });
});
