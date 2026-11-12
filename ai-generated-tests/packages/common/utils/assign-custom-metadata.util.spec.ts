import { describe, expect, it } from 'vitest';
import { assignCustomParameterMetadata } from '../../../../packages/common/utils/assign-custom-metadata.util.js';
import { CUSTOM_ROUTE_ARGS_METADATA } from '../../../../packages/common/constants.js';

describe('assignCustomParameterMetadata (C3)', () => {
  const factory = () => 'value';
  const pipe = { transform: (value: unknown) => value };

  it('adds an entry without a schema', () => {
    const args = { existing: { index: 9 } } as any;
    const result: any = assignCustomParameterMetadata(
      args,
      'custom',
      1,
      factory as any,
      { id: 1 },
      undefined,
      pipe as any,
    );

    expect(result.existing).toBe(args.existing);
    expect(result[`custom${CUSTOM_ROUTE_ARGS_METADATA}:1`]).toEqual({
      index: 1,
      factory,
      data: { id: 1 },
      pipes: [pipe],
    });
    expect(
      Object.prototype.hasOwnProperty.call(
        result[`custom${CUSTOM_ROUTE_ARGS_METADATA}:1`],
        'schema',
      ),
    ).toBe(false);
  });

  it('adds the schema when it is not undefined', () => {
    const schema = { '~standard': { version: 1, vendor: 'test' } };
    const result: any = assignCustomParameterMetadata(
      {} as any,
      0 as any,
      2,
      factory as any,
      undefined,
      schema as any,
    );

    expect(result[`0${CUSTOM_ROUTE_ARGS_METADATA}:2`].schema).toBe(schema);
    expect(result[`0${CUSTOM_ROUTE_ARGS_METADATA}:2`].pipes).toEqual([]);
  });

  it('adds the schema when it is null', () => {
    const result: any = assignCustomParameterMetadata(
      {} as any,
      'p',
      0,
      factory as any,
      undefined,
      null as any,
    );

    expect(result[`p${CUSTOM_ROUTE_ARGS_METADATA}:0`].schema).toBeNull();
  });
});
