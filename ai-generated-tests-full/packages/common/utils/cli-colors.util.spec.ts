import { afterEach, describe, expect, it } from 'vitest';
import {
  clc,
  isColorAllowed,
  yellow,
} from '../../../../packages/common/utils/cli-colors.util.js';

const originalNoColor = process.env.NO_COLOR;

describe('cli-colors.util', () => {
  afterEach(() => {
    if (originalNoColor === undefined) {
      delete process.env.NO_COLOR;
    } else {
      process.env.NO_COLOR = originalNoColor;
    }
  });

  it.each([
    ['NO_COLOR set', '1', false],
    ['NO_COLOR empty', '', true],
    ['NO_COLOR missing', undefined, true],
  ])('isColorAllowed for %s', (_label, noColor, expected) => {
    if (noColor === undefined) {
      delete process.env.NO_COLOR;
    } else {
      process.env.NO_COLOR = noColor;
    }
    expect(isColorAllowed()).toBe(expected);
  });

  it.each([
    ['bold', 'bold'],
    ['green', 'green'],
    ['yellow', 'yellow'],
    ['red', 'red'],
    ['magentaBright', 'magentaBright'],
    ['cyanBright', 'cyanBright'],
  ] as const)('wraps with ansi codes when color is allowed (%s)', name => {
    delete process.env.NO_COLOR;
    expect(clc[name]('text')).toContain('\x1B[');
  });

  it('returns raw text for clc when color is disabled', () => {
    process.env.NO_COLOR = '1';
    for (const fn of Object.values(clc)) {
      expect(fn('text')).toBe('text');
    }
  });

  it.each([
    ['allowed', undefined, '\x1B[38;5;3mtext\x1B[39m'],
    ['disabled', '1', 'text'],
  ])('yellow when color is %s', (_label, noColor, expected) => {
    if (noColor === undefined) {
      delete process.env.NO_COLOR;
    } else {
      process.env.NO_COLOR = noColor;
    }
    expect(yellow('text')).toBe(expected);
  });
});
