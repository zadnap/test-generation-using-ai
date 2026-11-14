import { describe, expect, it } from 'vitest';
import { ParseUUIDPipe } from '../../../../packages/common/pipes/parse-uuid.pipe.js';

const metadata = { type: 'param' } as any;
const v4 = '5c9f5a2e-8c6a-4f5b-9a1d-2b3c4d5e6f70';
const v1 = '5c9f5a2e-8c6a-1f5b-9a1d-2b3c4d5e6f70';
const nil = '00000000-0000-0000-0000-000000000000';
const max = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

describe('ParseUUIDPipe', () => {
  describe('transform', () => {
    it.each([
      ['undefined', undefined],
      ['null', null],
    ])('returns %s when optional', async (_label, value) => {
      await expect(
        new ParseUUIDPipe({ optional: true }).transform(value, metadata),
      ).resolves.toBe(value);
    });

    it.each([
      ['v4 default', v4, undefined],
      ['v4 explicit', v4, '4' as const],
      ['numeric version', v4, 4 as const],
      ['v1', v1, '1' as const],
      ['nil with all', nil, 'all' as const],
      ['max with all', max, 'all' as const],
    ])('accepts %s', async (_label, value, version) => {
      await expect(
        new ParseUUIDPipe({ version }).transform(value, metadata),
      ).resolves.toBe(value);
    });

    it.each([
      ['wrong version', v4, '1' as const],
      ['not a string', 1, undefined],
      ['invalid format', 'x', undefined],
      ['non-string without optional', null, undefined],
    ])('rejects %s', async (_label, value, version) => {
      await expect(
        new ParseUUIDPipe({ version }).transform(value, metadata),
      ).rejects.toBeInstanceOf(Error);
    });

    it('builds the default message for versions', async () => {
      await expect(
        new ParseUUIDPipe({ version: '4' }).transform('x', metadata),
      ).rejects.toThrow('Validation failed (uuid v 4 is expected)');
    });

    it('builds the default message for all versions', async () => {
      await expect(
        new ParseUUIDPipe({ version: 'all' }).transform('x', metadata),
      ).rejects.toThrow('Validation failed (uuid is expected)');
    });

    it('throws for a non-string value when calling isUUID directly', () => {
      expect(() => (new ParseUUIDPipe() as any).isUUID(1)).toThrow(
        'The value passed as UUID is not a string',
      );
    });

    it('returns false for an unknown version pattern', () => {
      expect((new ParseUUIDPipe() as any).isUUID(v4, 'unknown')).toBeUndefined();
    });

    it('supports a custom exception factory', async () => {
      await expect(
        new ParseUUIDPipe({
          exceptionFactory: e => new Error(`custom:${e}`),
        }).transform('x', metadata),
      ).rejects.toThrow('custom:Validation failed (uuid is expected)');
    });
  });
});
