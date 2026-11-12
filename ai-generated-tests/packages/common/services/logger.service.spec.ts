import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '../../../../packages/common/services/logger.service.js';
import { ConsoleLogger } from '../../../../packages/common/services/console-logger.service.js';

const staticState = Logger as any;
const originalState = {
  staticInstanceRef: staticState.staticInstanceRef,
  logLevels: staticState.logLevels,
  isBufferAttached: staticState.isBufferAttached,
};

function createLoggerService(overrides: Record<string, unknown> = {}) {
  return {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
    fatal: vi.fn(),
    setLogLevels: vi.fn(),
    ...overrides,
  } as any;
}

describe('Logger (C3)', () => {
  beforeEach(() => {
    staticState.staticInstanceRef = originalState.staticInstanceRef;
    staticState.logLevels = originalState.logLevels;
    staticState.isBufferAttached = false;
    staticState.logBuffer = [];
  });

  afterEach(() => {
    staticState.staticInstanceRef = originalState.staticInstanceRef;
    staticState.logLevels = originalState.logLevels;
    staticState.isBufferAttached = false;
    staticState.logBuffer = [];
    vi.restoreAllMocks();
  });

  describe('localInstance', () => {
    it('registers a local ConsoleLogger for the default instance', () => {
      const logger = new Logger('Ctx');
      expect(logger.localInstance).toBeInstanceOf(ConsoleLogger);
      expect(logger.localInstance).toBe(logger.localInstance);
    });

    it('registers a local instance when the static instance is a plain Logger', () => {
      staticState.staticInstanceRef = new Logger('Static');
      const logger = new Logger('Ctx');
      expect(logger.localInstance).toBeInstanceOf(ConsoleLogger);
    });

    it('returns the static instance when it is a subclass', () => {
      class SubLogger extends Logger {}
      const sub = new SubLogger('Sub');
      staticState.staticInstanceRef = sub;
      const logger = new Logger('Ctx');

      expect(logger.localInstance).toBe(sub);
    });

    it('returns a custom static instance', () => {
      const custom = createLoggerService();
      staticState.staticInstanceRef = custom;
      expect(new Logger().localInstance).toBe(custom);
    });

    it('returns undefined when logging is disabled', () => {
      staticState.staticInstanceRef = undefined;
      expect(new Logger().localInstance).toBeUndefined();
    });
  });

  describe('instance methods', () => {
    it.each(['error', 'log', 'warn', 'debug', 'verbose', 'fatal'] as const)(
      'appends the context to %s',
      method => {
        const custom = createLoggerService();
        staticState.staticInstanceRef = custom;
        new Logger('Ctx')[method]('message', 'extra');

        expect(custom[method]).toHaveBeenCalledWith(
          'message',
          'extra',
          'Ctx',
        );
      },
    );

    it('passes an undefined stack placeholder for error without params', () => {
      const custom = createLoggerService();
      staticState.staticInstanceRef = custom;
      new Logger('Ctx').error('message');

      expect(custom.error).toHaveBeenCalledWith(
        'message',
        undefined,
        'Ctx',
      );
    });

    it('does not add a placeholder for error when params exist', () => {
      const custom = createLoggerService();
      staticState.staticInstanceRef = custom;
      new Logger('Ctx').error('message', 'stack');

      expect(custom.error).toHaveBeenCalledWith('message', 'stack', 'Ctx');
    });

    it.each(['error', 'log', 'warn', 'debug', 'verbose', 'fatal'] as const)(
      'forwards %s without a context',
      method => {
        const custom = createLoggerService();
        staticState.staticInstanceRef = custom;
        new Logger()[method]('message', 'arg');

        expect(custom[method]).toHaveBeenCalledWith('message', 'arg');
      },
    );

    it('skips optional methods that are missing', () => {
      const custom = createLoggerService({
        debug: undefined,
        verbose: undefined,
        fatal: undefined,
      });
      staticState.staticInstanceRef = custom;
      const logger = new Logger('Ctx');

      expect(() => {
        logger.debug('d');
        logger.verbose('v');
        logger.fatal('f');
      }).not.toThrow();
    });

    it('does nothing when logging is disabled', () => {
      staticState.staticInstanceRef = undefined;
      const logger = new Logger('Ctx');
      expect(() => {
        logger.error('e');
        logger.log('l');
        logger.warn('w');
        logger.debug('d');
        logger.verbose('v');
        logger.fatal('f');
      }).not.toThrow();
    });
  });

  describe('static methods', () => {
    it.each(['error', 'log', 'warn', 'debug', 'verbose', 'fatal'] as const)(
      'forwards static %s to the static instance',
      method => {
        const custom = createLoggerService();
        staticState.staticInstanceRef = custom;
        Logger[method]('message', 'arg');
        expect(custom[method]).toHaveBeenCalledWith('message', 'arg');
      },
    );

    it('skips optional static methods that are missing', () => {
      const custom = createLoggerService({
        debug: undefined,
        verbose: undefined,
        fatal: undefined,
      });
      staticState.staticInstanceRef = custom;

      expect(() => {
        Logger.debug('d');
        Logger.verbose('v');
        Logger.fatal('f');
      }).not.toThrow();
    });

    it('does nothing when the static instance is unset', () => {
      staticState.staticInstanceRef = undefined;
      expect(() => {
        Logger.error('e');
        Logger.log('l');
        Logger.warn('w');
        Logger.debug('d');
        Logger.verbose('v');
        Logger.fatal('f');
      }).not.toThrow();
    });
  });

  describe('buffer', () => {
    it('buffers static calls until flush', () => {
      const custom = createLoggerService();
      staticState.staticInstanceRef = custom;

      Logger.attachBuffer();
      Logger.log('buffered', 'Ctx');
      Logger.error('failure');
      expect(custom.log).not.toHaveBeenCalled();

      Logger.flush();
      expect(custom.log).toHaveBeenCalledWith('buffered', 'Ctx');
      expect(custom.error).toHaveBeenCalledWith('failure');
    });

    it('buffers instance calls until flush', () => {
      const custom = createLoggerService();
      staticState.staticInstanceRef = custom;
      const logger = new Logger('Ctx');

      Logger.attachBuffer();
      logger.warn('buffered');
      expect(custom.warn).not.toHaveBeenCalled();

      Logger.detachBuffer();
      logger.debug('after-detach');
      expect(custom.debug).toHaveBeenCalledWith('after-detach', 'Ctx');

      Logger.flush();
      expect(custom.warn).toHaveBeenCalledWith('buffered', 'Ctx');
    });
  });

  describe('timestamp', () => {
    it('returns a formatted date string', () => {
      expect(typeof Logger.getTimestamp()).toBe('string');
      expect(Logger.getTimestamp().length).toBeGreaterThan(0);
    });
  });

  describe('overrideLogger', () => {
    it('sets the levels from an array', () => {
      const custom = createLoggerService();
      staticState.staticInstanceRef = custom;

      Logger.overrideLogger(['error']);

      expect(staticState.logLevels).toEqual(['error']);
      expect(custom.setLogLevels).toHaveBeenCalledWith(['error']);
    });

    it('handles an array when the instance has no setLogLevels', () => {
      const custom = createLoggerService({ setLogLevels: undefined });
      staticState.staticInstanceRef = custom;

      expect(() => Logger.overrideLogger(['warn'])).not.toThrow();
      expect(staticState.logLevels).toEqual(['warn']);
    });

    it('handles an array when the static instance is unset', () => {
      staticState.staticInstanceRef = undefined;
      expect(() => Logger.overrideLogger(['warn'])).not.toThrow();
      expect(staticState.logLevels).toEqual(['warn']);
    });

    it('accepts a custom logger object', () => {
      const custom = createLoggerService();
      Logger.overrideLogger(custom);
      expect(staticState.staticInstanceRef).toBe(custom);
    });

    it('accepts a plain Logger instance', () => {
      const logger = new Logger();
      Logger.overrideLogger(logger);
      expect(staticState.staticInstanceRef).toBe(logger);
    });

    it('rejects a Logger subclass', () => {
      const custom = createLoggerService();
      staticState.staticInstanceRef = custom;
      class SubLogger extends Logger {}

      expect(() => Logger.overrideLogger(new SubLogger())).toThrowError(
        'Using the "extends Logger" instruction is not allowed in Nest v9. Please, use "extends ConsoleLogger" instead.',
      );
      expect(custom.error).toHaveBeenCalledTimes(1);
    });

    it.each([false, true])('disables logging for %s', value => {
      Logger.overrideLogger(value);
      expect(staticState.staticInstanceRef).toBeUndefined();
    });
  });

  describe('isLevelEnabled', () => {
    it('returns false when logging is disabled', () => {
      staticState.staticInstanceRef = undefined;
      expect(Logger.isLevelEnabled('log')).toBe(false);
    });

    it('delegates to a ConsoleLogger instance', () => {
      const consoleLogger = new ConsoleLogger('Ctx', {
        logLevels: ['error'],
      });
      staticState.staticInstanceRef = consoleLogger;

      expect(Logger.isLevelEnabled('error')).toBe(true);
      expect(Logger.isLevelEnabled('log')).toBe(false);
    });

    it('uses explicit levels for a custom logger', () => {
      staticState.staticInstanceRef = createLoggerService();
      staticState.logLevels = ['error'];

      expect(Logger.isLevelEnabled('error')).toBe(true);
      expect(Logger.isLevelEnabled('log')).toBe(false);
    });

    it('enables every level for a custom logger without explicit levels', () => {
      staticState.staticInstanceRef = createLoggerService();
      staticState.logLevels = undefined;

      expect(Logger.isLevelEnabled('log')).toBe(true);
      expect(Logger.isLevelEnabled('verbose')).toBe(true);
    });
  });

  describe('registerLocalInstanceRef', () => {
    it('updates an existing local instance when levels changed', () => {
      const logger = new Logger('Ctx');
      const local = createLoggerService();
      (logger as any).localInstanceRef = local;
      (logger as any).localInstanceLogLevels = ['log'];
      staticState.staticInstanceRef = originalState.staticInstanceRef;
      staticState.logLevels = ['error'];

      expect(
        (logger as any).registerLocalInstanceRef(),
      ).toBe(local);
      expect(local.setLogLevels).toHaveBeenCalledWith(['error']);
      expect((logger as any).localInstanceLogLevels).toEqual(['error']);
    });

    it('does not update an existing local instance without levels', () => {
      const logger = new Logger('Ctx');
      const local = createLoggerService();
      (logger as any).localInstanceRef = local;
      staticState.staticInstanceRef = originalState.staticInstanceRef;
      staticState.logLevels = undefined;

      expect((logger as any).registerLocalInstanceRef()).toBe(local);
      expect(local.setLogLevels).not.toHaveBeenCalled();
    });

    it('does not update when the levels are unchanged', () => {
      const levels = ['log' as const];
      const logger = new Logger('Ctx');
      const local = createLoggerService();
      (logger as any).localInstanceRef = local;
      (logger as any).localInstanceLogLevels = levels;
      staticState.staticInstanceRef = originalState.staticInstanceRef;
      staticState.logLevels = levels;

      expect((logger as any).registerLocalInstanceRef()).toBe(local);
      expect(local.setLogLevels).not.toHaveBeenCalled();
    });

    it('creates a ConsoleLogger with the context and options', () => {
      staticState.staticInstanceRef = originalState.staticInstanceRef;
      staticState.logLevels = ['error'];
      const logger = new Logger('Ctx', { timestamp: true });

      const local = (logger as any).registerLocalInstanceRef();

      expect(local).toBeInstanceOf(ConsoleLogger);
      expect((local as any).context).toBe('Ctx');
      expect((local as any).options.timestamp).toBe(true);
      expect((local as any).options.logLevels).toEqual(['error']);
    });

    it('creates a ConsoleLogger without a context', () => {
      staticState.staticInstanceRef = originalState.staticInstanceRef;
      staticState.logLevels = undefined;
      const logger = new Logger();

      const local = (logger as any).registerLocalInstanceRef();

      expect(local).toBeInstanceOf(ConsoleLogger);
      expect((local as any).context).toBeUndefined();
    });
  });
});
