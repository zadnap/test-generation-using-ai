import { describe, expect, it } from 'vitest';
import { FASTIFY_ROUTE_CONFIG_METADATA } from '../../../../packages/platform-fastify/constants.js';
import { RouteConfig } from '../../../../packages/platform-fastify/decorators/route-config.decorator.js';

// RouteConfig: 0 decision node, 1 independent path.
describe('RouteConfig', () => {
  it.each([
    ['plain object', { cache: 60 }],
    ['empty object', {}],
    ['array value', [{ a: 1 }]],
    ['null value', null],
    ['primitive value', 'config'],
  ])('should attach the %s under the route config metadata key', (_, config) => {
    class Target {}

    const decorator = RouteConfig(config);
    decorator(Target);

    expect(Reflect.getMetadata(FASTIFY_ROUTE_CONFIG_METADATA, Target)).toBe(
      config,
    );
  });

  it('should support method decorators', () => {
    class Target {
      handler() {}
    }
    const config = { rateLimit: { max: 1 } };

    RouteConfig(config)(Target.prototype, 'handler', {
      value: Target.prototype.handler,
    });

    expect(
      Reflect.getMetadata(FASTIFY_ROUTE_CONFIG_METADATA, Target.prototype.handler),
    ).toBe(config);
  });
});
