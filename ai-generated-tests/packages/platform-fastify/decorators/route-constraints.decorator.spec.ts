import { describe, expect, it } from 'vitest';
import { FASTIFY_ROUTE_CONSTRAINTS_METADATA } from '../../../../packages/platform-fastify/constants.js';
import { RouteConstraints } from '../../../../packages/platform-fastify/decorators/route-constraints.decorator.js';

// RouteConstraints: 0 decision node, 1 independent path.
describe('RouteConstraints', () => {
  it.each([
    ['version constraint', { version: '2' }],
    ['host constraint', { host: 'example.com' }],
    ['empty constraints', {}],
    ['undefined constraints', undefined],
  ])('should attach the %s under the route constraints metadata key', (_, constraints) => {
    class Target {}

    RouteConstraints(constraints)(Target);

    expect(
      Reflect.getMetadata(FASTIFY_ROUTE_CONSTRAINTS_METADATA, Target),
    ).toBe(constraints);
  });

  it('should support method decorators', () => {
    class Target {
      handler() {}
    }
    const constraints = { version: ['1', '2'] };

    RouteConstraints(constraints)(Target.prototype, 'handler', {
      value: Target.prototype.handler,
    });

    expect(
      Reflect.getMetadata(
        FASTIFY_ROUTE_CONSTRAINTS_METADATA,
        Target.prototype.handler,
      ),
    ).toBe(constraints);
  });
});
