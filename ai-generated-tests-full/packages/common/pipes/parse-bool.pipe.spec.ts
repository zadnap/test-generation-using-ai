import { describe, expect, it } from 'vitest';
import { ParseBoolPipe } from '../../../../packages/common/pipes/parse-bool.pipe.js';

const metadata = { type: 'query' } as any;

describe('ParseBoolPipe', () => {
  it.each([
    ['true boolean', true],
    ['true string', 'true'],
  ])('parses %s to true', async (_label, value) => {
    await expect(new ParseBoolPipe().transform(value, metadata)).resolves.toBe(
      true,
    );
  });

  it.each([
    ['false boolean', false],
    ['false string', 'false'],
  ])('parses %s to false', async (_label, value) => {
    await expect(new ParseBoolPipe().transform(value, metadata)).resolves.toBe(
      false,
    );
  });

  it.each([
    ['truthy string', 'TRUE'],
    ['number', 1],
    ['null without optional', null],
  ])('rejects %s', async (_label, value) => {
    await expect(
      new ParseBoolPipe().transform(value, metadata),
    ).rejects.toBeInstanceOf(Error);
  });

  it.each([
    ['undefined optional', undefined],
    ['null optional', null],
  ])('returns nil for %s', async (_label, value) => {
    await expect(
      new ParseBoolPipe({ optional: true }).transform(value, metadata),
    ).resolves.toBe(value);
  });

  it('supports a custom exception factory', async () => {
    const factory = (error: string) => new Error(error);
    await expect(
      new ParseBoolPipe({ exceptionFactory: factory }).transform('x', metadata),
    ).rejects.toThrow('Validation failed (boolean string is expected)');
  });
});
