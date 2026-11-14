import { describe, expect, it } from 'vitest';
import { SCOPE_OPTIONS_METADATA } from '../../../../packages/common/constants.js';
import { isDurable } from '../../../../packages/core/helpers/is-durable.js';

describe('isDurable', () => {
  it('xc1(T): returns the durable flag from metadata', () => {
    class Provider {}
    Reflect.defineMetadata(SCOPE_OPTIONS_METADATA, { durable: true }, Provider);

    expect(isDurable(Provider)).toBe(true);
  });

  it('xc1(F): returns undefined without metadata', () => {
    class Provider {}

    expect(isDurable(Provider)).toBeUndefined();
  });

  it('xc1(F): returns undefined when durable is not set', () => {
    class Provider {}
    Reflect.defineMetadata(SCOPE_OPTIONS_METADATA, {}, Provider);

    expect(isDurable(Provider)).toBeUndefined();
  });
});
