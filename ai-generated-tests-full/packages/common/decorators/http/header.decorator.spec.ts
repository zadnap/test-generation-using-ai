import { describe, expect, it } from 'vitest';
import { HEADERS_METADATA } from '../../../../../packages/common/constants.js';
import { Header } from '../../../../../packages/common/decorators/http/header.decorator.js';

describe('Header', () => {
  it('registers a static header and returns the descriptor', () => {
    const descriptor = { value: () => undefined };

    const result = Header('Cache-Control', 'none')(
      {},
      'handler',
      descriptor,
    );

    expect(result).toBe(descriptor);
    expect(Reflect.getMetadata(HEADERS_METADATA, descriptor.value)).toEqual([
      { name: 'Cache-Control', value: 'none' },
    ]);
  });

  it('accumulates headers and supports a function value', () => {
    const descriptor = { value: () => undefined };
    const value = () => 'none';

    Header('X-First', 'one')({}, 'handler', descriptor);
    Header('X-Second', value)({}, 'handler', descriptor);

    expect(Reflect.getMetadata(HEADERS_METADATA, descriptor.value)).toEqual([
      { name: 'X-First', value: 'one' },
      { name: 'X-Second', value },
    ]);
  });
});
