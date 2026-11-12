import { describe, expect, it } from 'vitest';
import { VERSION_NEUTRAL } from '../../../../packages/common/interfaces/version-options.interface.js';

describe('VERSION_NEUTRAL (C3)', () => {
  it('is a symbol', () => {
    expect(typeof VERSION_NEUTRAL).toBe('symbol');
  });

  it('has the expected description', () => {
    expect(VERSION_NEUTRAL.description).toBe('VERSION_NEUTRAL');
    expect(String(VERSION_NEUTRAL)).toBe('Symbol(VERSION_NEUTRAL)');
  });

  it('is unique on each evaluation', () => {
    expect(VERSION_NEUTRAL).not.toBe(Symbol('VERSION_NEUTRAL'));
  });

  it('is stable when imported more than once', async () => {
    const again = await import(
      '../../../../packages/common/interfaces/version-options.interface.js'
    );
    expect(again.VERSION_NEUTRAL).toBe(VERSION_NEUTRAL);
  });

  it('can be used inside version arrays', () => {
    const versions = ['1', VERSION_NEUTRAL];
    expect(versions).toContain(VERSION_NEUTRAL);
    expect(versions[0]).toBe('1');
  });
});
