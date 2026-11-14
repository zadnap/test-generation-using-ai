import { describe, expect, it } from 'vitest';
import { CUSTOM_ROUTE_ARGS_METADATA } from '../../../../packages/common/constants.js';
import { assignCustomParameterMetadata } from '../../../../packages/common/utils/assign-custom-metadata.util.js';

describe('assignCustomParameterMetadata', () => {
  const factory = () => 'value';

  it.each([
    ['without schema', undefined, false],
    ['with schema', { '~standard': {} } as any, true],
  ])('writes the metadata entry (%s)', (_label, schema, hasSchema) => {
    const result = assignCustomParameterMetadata(
      {},
      1,
      2,
      factory,
      'data',
      schema as any,
    );
    const entry = result[`1${CUSTOM_ROUTE_ARGS_METADATA}:2`];

    expect(entry.index).toBe(2);
    expect(entry.factory).toBe(factory);
    expect(entry.data).toBe('data');
    expect(Object.hasOwn(entry, 'schema')).toBe(hasSchema);
  });

  it('keeps existing args and supports string and numeric param types', () => {
    const existing = { keep: true } as any;
    const asNumber = assignCustomParameterMetadata(existing, 3, 0, factory);
    const asString = assignCustomParameterMetadata(
      asNumber,
      'custom',
      1,
      factory,
    );

    expect(asNumber.keep).toBe(true);
    expect(asString).toHaveProperty(`custom${CUSTOM_ROUTE_ARGS_METADATA}:1`);
  });
});
