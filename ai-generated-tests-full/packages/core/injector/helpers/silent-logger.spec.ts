import { describe, expect, it } from 'vitest';
import { SilentLogger } from '../../../../../packages/core/injector/helpers/silent-logger.js';

describe('SilentLogger', () => {
  it('provides no-op logging methods', () => {
    const logger = new SilentLogger();

    expect(() => logger.log('message')).not.toThrow();
    expect(() => logger.error('message')).not.toThrow();
    expect(() => logger.warn('message')).not.toThrow();
    expect(() => logger.debug('message')).not.toThrow();
    expect(() => logger.verbose('message')).not.toThrow();
    expect(() => logger.fatal('message')).not.toThrow();
    expect(() => logger.setLogLevels(['log'])).not.toThrow();
  });

  it('returns undefined from every method', () => {
    const logger = new SilentLogger();

    expect(logger.log('message')).toBeUndefined();
    expect(logger.error('message')).toBeUndefined();
    expect(logger.setLogLevels(['log'])).toBeUndefined();
  });
});
