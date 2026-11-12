import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clc,
  isColorAllowed,
  yellow,
} from '../../../../packages/common/utils/cli-colors.util.js';

describe('cli-colors.util (C3)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('isColorAllowed', () => {
    it('returns true when NO_COLOR is not set', () => {
      delete process.env.NO_COLOR;
      expect(isColorAllowed()).toBe(true);
    });

    it('returns true when NO_COLOR is an empty string', () => {
      vi.stubEnv('NO_COLOR', '');
      expect(isColorAllowed()).toBe(true);
    });

    it.each(['1', 'true', '0'])(
      'returns false when NO_COLOR is %s',
      value => {
        vi.stubEnv('NO_COLOR', value);
        expect(isColorAllowed()).toBe(false);
      },
    );
  });

  describe('color functions', () => {
    const entries: [string, (text: string) => string, string][] = [
      ['bold', clc.bold, '\x1B[1mtext\x1B[0m'],
      ['green', clc.green, '\x1B[32mtext\x1B[39m'],
      ['yellow', clc.yellow, '\x1B[33mtext\x1B[39m'],
      ['red', clc.red, '\x1B[31mtext\x1B[39m'],
      ['magentaBright', clc.magentaBright, '\x1B[95mtext\x1B[39m'],
      ['cyanBright', clc.cyanBright, '\x1B[96mtext\x1B[39m'],
      ['yellow export', yellow, '\x1B[38;5;3mtext\x1B[39m'],
    ];

    it.each(entries)('colors text with %s', (_name, color, expected) => {
      delete process.env.NO_COLOR;
      expect(color('text')).toBe(expected);
    });

    it.each(entries)('returns plain text for %s when colors are disabled', (_name, color) => {
      vi.stubEnv('NO_COLOR', '1');
      expect(color('text')).toBe('text');
    });
  });
});
