import { describe, expect, it } from 'vitest';
import { FASTIFY_ROUTE_SCHEMA_METADATA } from '../../../../packages/platform-fastify/constants.js';
import { RouteSchema } from '../../../../packages/platform-fastify/decorators/route-schema.decorator.js';

// RouteSchema: 0 decision node, 1 independent path.
describe('RouteSchema', () => {
  it.each([
    ['body schema', { body: { type: 'object' } }],
    ['response schema', { response: { 200: { type: 'string' } } }],
    ['query and params', { querystring: { type: 'object' }, params: { type: 'object' } }],
    ['empty schema', {}],
  ])('should attach the %s under the route schema metadata key', (_, schema) => {
    class Target {}

    RouteSchema(schema)(Target);

    expect(Reflect.getMetadata(FASTIFY_ROUTE_SCHEMA_METADATA, Target)).toBe(
      schema,
    );
  });

  it('should support method decorators', () => {
    class Target {
      handler() {}
    }
    const schema = { body: { type: 'array' } };

    RouteSchema(schema)(Target.prototype, 'handler', {
      value: Target.prototype.handler,
    });

    expect(
      Reflect.getMetadata(FASTIFY_ROUTE_SCHEMA_METADATA, Target.prototype.handler),
    ).toBe(schema);
  });
});
