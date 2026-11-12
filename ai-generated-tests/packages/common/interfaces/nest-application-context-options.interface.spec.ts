import { describe, expect, it } from 'vitest';
import { NestApplicationContextOptions } from '../../../../packages/common/interfaces/nest-application-context-options.interface.js';

describe('NestApplicationContextOptions (C3)', () => {
  it('can be instantiated without arguments', () => {
    const options = new NestApplicationContextOptions();

    expect(options).toBeInstanceOf(NestApplicationContextOptions);
    expect(options.logger).toBeUndefined();
    expect(options.abortOnError).toBeUndefined();
    expect(options.bufferLogs).toBeUndefined();
    expect(options.autoFlushLogs).toBeUndefined();
    expect(options.preview).toBeUndefined();
    expect(options.snapshot).toBeUndefined();
    expect(options.moduleIdGeneratorAlgorithm).toBeUndefined();
    expect(options.instrument).toBeUndefined();
    expect(options.forceConsole).toBeUndefined();
  });

  it('accepts a disabled logger', () => {
    const options = new NestApplicationContextOptions();
    options.logger = false;
    expect(options.logger).toBe(false);
  });

  it('accepts an array of log levels', () => {
    const options = new NestApplicationContextOptions();
    options.logger = ['error', 'warn'];
    expect(options.logger).toEqual(['error', 'warn']);
  });

  it('accepts a custom logger service', () => {
    const logger = {
      log: () => undefined,
      error: () => undefined,
      warn: () => undefined,
    };
    const options = new NestApplicationContextOptions();
    options.logger = logger;
    expect(options.logger).toBe(logger);
  });

  it.each([true, false, undefined])(
    'accepts abortOnError %s',
    abortOnError => {
      const options = new NestApplicationContextOptions();
      options.abortOnError = abortOnError;
      expect(options.abortOnError).toBe(abortOnError);
    },
  );

  it.each([
    ['bufferLogs', true],
    ['autoFlushLogs', false],
    ['preview', true],
    ['snapshot', true],
    ['forceConsole', true],
  ] as const)('accepts %s = %s', (key, value) => {
    const options = new NestApplicationContextOptions();
    options[key] = value;
    expect(options[key]).toBe(value);
  });

  it.each(['deep-hash', 'reference'] as const)(
    'accepts the module id algorithm %s',
    algorithm => {
      const options = new NestApplicationContextOptions();
      options.moduleIdGeneratorAlgorithm = algorithm;
      expect(options.moduleIdGeneratorAlgorithm).toBe(algorithm);
    },
  );

  it('accepts an instrument decorator', () => {
    const instanceDecorator = (instance: unknown) => instance;
    const options = new NestApplicationContextOptions();
    options.instrument = { instanceDecorator };

    expect(options.instrument?.instanceDecorator('value')).toBe('value');
  });
});
