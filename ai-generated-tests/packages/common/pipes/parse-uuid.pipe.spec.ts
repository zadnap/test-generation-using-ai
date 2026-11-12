import { describe, expect, it } from 'vitest';
import {
  ParseUUIDPipe,
  type UUIDVersion,
} from '../../../../packages/common/pipes/parse-uuid.pipe.js';
import { HttpStatus } from '../../../../packages/common/enums/http-status.enum.js';
import { ImATeapotException } from '../../../../packages/common/exceptions/im-a-teapot.exception.js';
import type { ArgumentMetadata } from '../../../../packages/common/interfaces/features/pipe-transform.interface.js';

const metadata = {} as ArgumentMetadata;

const v1 = 'c232ab00-9414-11ec-b3c8-9f6bdeced846';
const v2 = '000003e8-9414-21ec-b300-9f6bdeced846';
const v3 = 'e8b5a51d-11c8-3310-a6ab-367563f20686';
const v4 = '10ba038e-48da-487b-96e8-8d3b99b6d18a';
const v5 = '630eb68f-e0fa-5ecc-887a-7c7a62614681';
const v6 = '1ec9414c-232a-6b00-b3c8-9f6bdeced846';
const v7 = '017f22e2-79b0-7cc3-98c4-dc0c0c07398f';
const v8 = '2489e9ad-2ee2-8e00-8ec9-32d5f69181c0';

class ExposedParseUUIDPipe extends ParseUUIDPipe {
  callIsUUID(value: unknown, version?: UUIDVersion) {
    return this.isUUID(value, version);
  }
}

describe('ParseUUIDPipe (C3)', () => {
  describe('transform', () => {
    it.each([undefined, null])(
      'returns a nil value when optional is enabled (%s)',
      async value => {
        const pipe = new ParseUUIDPipe({ optional: true });
        expect(await pipe.transform(value, metadata)).toBe(value);
      },
    );

    it.each([undefined, null])(
      'rejects a nil value when optional is disabled (%s)',
      async value => {
        const pipe = new ParseUUIDPipe();
        await expect(pipe.transform(value, metadata)).rejects.toBeDefined();
      },
    );

    it.each([
      ['v1', v1, 1],
      ['v2', v2, 2],
      ['v3', v3, 3],
      ['v4', v4, 4],
      ['v5', v5, 5],
      ['v6', v6, 6],
      ['v7', v7, 7],
      ['v8', v8, 8],
    ] as const)('accepts %s when its version is requested', async (_l, id, v) => {
      const pipe = new ParseUUIDPipe({ version: v });
      expect(await pipe.transform(id, metadata)).toBe(id);
    });

    it.each([
      [v1, 'all'],
      [v4, 'all'],
      [v8, 'all'],
      ['00000000-0000-0000-0000-000000000000', 'all'],
      ['FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF', 'all'],
    ] as const)('accepts %s with version all', async (id, version) => {
      const pipe = new ParseUUIDPipe({ version });
      expect(await pipe.transform(id, metadata)).toBe(id);
    });

    it('uses the default version when none is provided', async () => {
      const pipe = new ParseUUIDPipe();
      expect(await pipe.transform(v4, metadata)).toBe(v4);
    });

    it.each([
      ['wrong version', v4, 1],
      ['not a uuid', 'nope', 'all'],
      ['empty string', '', 'all'],
      ['unknown version', v4, '9' as UUIDVersion],
    ])('rejects %s', async (_label, value, version) => {
      const pipe = new ParseUUIDPipe({ version });
      await expect(pipe.transform(value, metadata)).rejects.toBeDefined();
    });

    it('reports the requested version in the default error message', async () => {
      const pipe = new ParseUUIDPipe({ version: 4 });
      await expect(pipe.transform('nope', metadata)).rejects.toThrowError(
        /v 4/,
      );
    });

    it('uses a custom exception factory', async () => {
      const pipe = new ParseUUIDPipe({
        exceptionFactory: () => new ImATeapotException(),
      });
      await expect(pipe.transform('nope', metadata)).rejects.toBeInstanceOf(
        ImATeapotException,
      );
    });

    it('uses the configured status code', async () => {
      const pipe = new ParseUUIDPipe({
        errorHttpStatusCode: HttpStatus.I_AM_A_TEAPOT,
      });
      await expect(pipe.transform('nope', metadata)).rejects.toMatchObject({
        status: HttpStatus.I_AM_A_TEAPOT,
      });
    });

    it('uses the default factory without options', async () => {
      const pipe = new ParseUUIDPipe();
      await expect(pipe.transform('nope', metadata)).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
    });
  });

  describe('isUUID', () => {
    it('throws for a non-string value', () => {
      const pipe = new ExposedParseUUIDPipe();
      expect(() => pipe.callIsUUID(12)).toThrowError();
    });

    it.each([v1, v2, v3, v4, v5, v6, v7, v8])(
      'accepts %s with the all pattern',
      value => {
        expect(new ExposedParseUUIDPipe().callIsUUID(value)).toBe(true);
      },
    );

    it('returns undefined for an unknown pattern', () => {
      const pipe = new ExposedParseUUIDPipe();
      expect(pipe.callIsUUID(v4, '9' as UUIDVersion)).toBeUndefined();
    });
  });
});
