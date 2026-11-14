import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '../../../../packages/common/services/logger.service.js';
import { ConsoleLogger } from '../../../../packages/common/services/console-logger.service.js';

const state = {
  instance: (Logger as any).staticInstanceRef,
  levels: (Logger as any).logLevels,
  buffer: (Logger as any).isBufferAttached,
};

const restore = () => {
  (Logger as any).staticInstanceRef = state.instance;
  (Logger as any).logLevels = state.levels;
  (Logger as any).isBufferAttached = state.buffer;
  (Logger as any).logBuffer = [];
};

afterEach(restore);

const stubLogger = () => ({
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  verbose: vi.fn(),
  fatal: vi.fn(),
  setLogLevels: vi.fn(),
});

describe('Logger', () => {
  describe('localInstance', () => {
    it('creates a ConsoleLogger for the default logger', () => {
      const instance = new Logger('Ctx').localInstance;
      expect(instance).toBeInstanceOf(ConsoleLogger);
      expect((instance as any).context).toBe('Ctx');
    });

    it('returns an explicitly overridden logger instance', () => {
      const stub = stubLogger();
      Logger.overrideLogger(stub as any);
      expect(new Logger().localInstance).toBe(stub);
    });

    it('re-registers a local instance when the static ref is a Logger', () => {
      (Logger as any).staticInstanceRef = new Logger('Other');
      const instance = new Logger('Ctx').localInstance;
      expect(instance).toBeInstanceOf(ConsoleLogger);
    });

    it('updates an existing local instance when levels change', () => {
      const logger = new Logger('Ctx');
      const first = logger.localInstance as ConsoleLogger;
      const spy = vi.spyOn(first, 'setLogLevels');
      Logger.overrideLogger(['error']);
      expect(logger.localInstance).toBe(first);
      expect(spy).toHaveBeenCalledWith(['error']);
    });
  });

  describe('instance methods', () => {
    it.each([
      ['error', ['msg', 'ctx']],
      ['log', ['msg', 'ctx']],
      ['warn', ['msg', 'ctx']],
      ['debug', ['msg', 'ctx']],
      ['verbose', ['msg', 'ctx']],
      ['fatal', ['msg', 'ctx']],
    ] as const)('forwards %s to the local instance', (method, args) => {
      const stub = stubLogger();
      Logger.overrideLogger(stub as any);
      (new Logger('Ctx') as any)[method](...args);
      expect((stub as any)[method]).toHaveBeenCalled();
    });

    it('appends the instance context to log arguments', () => {
      const stub = stubLogger();
      Logger.overrideLogger(stub as any);
      new Logger('Ctx').log('message');
      expect(stub.log).toHaveBeenCalledWith('message', 'Ctx');
    });

    it('adds a placeholder before the context for error', () => {
      const stub = stubLogger();
      Logger.overrideLogger(stub as any);
      new Logger('Ctx').error('message');
      expect(stub.error).toHaveBeenCalledWith('message', undefined, 'Ctx');
    });

    it('forwards raw arguments when no context is set', () => {
      const stub = stubLogger();
      Logger.overrideLogger(stub as any);
      new Logger().log('message', 'custom');
      expect(stub.log).toHaveBeenCalledWith('message', 'custom');
    });

    it('tolerates optional methods that are not implemented', () => {
      const stub = { log: vi.fn(), error: vi.fn(), warn: vi.fn() };
      Logger.overrideLogger(stub as any);
      const logger = new Logger();
      expect(() => logger.debug('x')).not.toThrow();
      expect(() => logger.verbose('x')).not.toThrow();
      expect(() => logger.fatal('x')).not.toThrow();
    });
  });

  describe('static methods', () => {
    it.each([
      'error',
      'log',
      'warn',
      'debug',
      'verbose',
      'fatal',
    ] as const)('forwards static %s', method => {
      const stub = stubLogger();
      Logger.overrideLogger(stub as any);
      (Logger as any)[method]('message');
      expect((stub as any)[method]).toHaveBeenCalledWith('message');
    });

    it('does not throw when static logging is disabled', () => {
      Logger.overrideLogger(false);
      expect(() => Logger.log('message')).not.toThrow();
      expect(() => Logger.error('message')).not.toThrow();
    });
  });

  describe('buffer', () => {
    it('buffers calls until flush', () => {
      const stub = stubLogger();
      Logger.overrideLogger(stub as any);
      Logger.attachBuffer();
      const logger = new Logger('Ctx');
      logger.log('first');
      logger.warn('second');
      expect(stub.log).not.toHaveBeenCalled();
      Logger.flush();
      expect(stub.log).toHaveBeenCalledWith('first', 'Ctx');
      expect(stub.warn).toHaveBeenCalledWith('second', 'Ctx');
      expect((Logger as any).logBuffer).toEqual([]);
    });

    it('detachBuffer stops buffering', () => {
      const stub = stubLogger();
      Logger.overrideLogger(stub as any);
      Logger.attachBuffer();
      Logger.detachBuffer();
      new Logger().log('message');
      expect(stub.log).toHaveBeenCalledWith('message');
    });
  });

  describe('overrideLogger', () => {
    it('sets levels and forwards them to the instance', () => {
      const stub = stubLogger();
      Logger.overrideLogger(stub as any);
      Logger.overrideLogger(['warn']);
      expect((Logger as any).logLevels).toEqual(['warn']);
      expect(stub.setLogLevels).toHaveBeenCalledWith(['warn']);
    });

    it('replaces the instance with a logger object', () => {
      const stub = stubLogger();
      Logger.overrideLogger(stub as any);
      expect((Logger as any).staticInstanceRef).toBe(stub);
    });

    it('rejects a Logger subclass', () => {
      class CustomLogger extends Logger {}
      const stub = stubLogger();
      Logger.overrideLogger(stub as any);
      expect(() => Logger.overrideLogger(new CustomLogger() as any)).toThrow(
        'Using the "extends Logger" instruction is not allowed in Nest v9. Please, use "extends ConsoleLogger" instead.',
      );
      expect(stub.error).toHaveBeenCalled();
    });

    it('disables logging for false', () => {
      Logger.overrideLogger(false);
      expect((Logger as any).staticInstanceRef).toBeUndefined();
    });
  });

  describe('isLevelEnabled', () => {
    it('returns false when logging is disabled', () => {
      Logger.overrideLogger(false);
      expect(Logger.isLevelEnabled('log')).toBe(false);
    });

    it('delegates to a ConsoleLogger instance', () => {
      const consoleLogger = new ConsoleLogger();
      const spy = vi.spyOn(consoleLogger, 'isLevelEnabled');
      Logger.overrideLogger(consoleLogger);
      expect(Logger.isLevelEnabled('warn')).toBe(spy.mock.results[0]?.value ?? true);
      expect(spy).toHaveBeenCalledWith('warn');
    });

    it('enables every level for a custom logger without configured levels', () => {
      Logger.overrideLogger(stubLogger() as any);
      (Logger as any).logLevels = undefined;
      expect(Logger.isLevelEnabled('fatal')).toBe(true);
    });

    it('uses the configured levels for a custom logger', () => {
      Logger.overrideLogger(stubLogger() as any);
      (Logger as any).logLevels = ['error'];
      expect(Logger.isLevelEnabled('warn')).toBe(false);
      expect(Logger.isLevelEnabled('fatal')).toBe(true);
      expect(Logger.isLevelEnabled('debug')).toBe(false);
    });
  });

  it('exposes a formatted timestamp', () => {
    expect(typeof Logger.getTimestamp()).toBe('string');
  });
});
