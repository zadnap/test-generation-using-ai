import { ConsoleLogger, Logger, LoggerService } from '@nestjs/common';
import { CapturingLogger } from '../../../../packages/testing/services/capturing-logger.service.js';

function seedLogs(logger: CapturingLogger) {
  logger.log('Mapped {/orders, GET} route', 'RouterExplorer');
  logger.log('Order created', { orderId: 1, items: [1, 2] }, 'Orders');
  logger.warn('Retrying payment (attempt 2)', 'Payments');
  logger.error('Payment failed', new Error('declined'), 'Payments');
  logger.log({ shape: true });
}

describe('CapturingLogger', () => {
  let logger: CapturingLogger;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logger = new CapturingLogger();
    stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('constructor', () => {
    it('is a ConsoleLogger', () => {
      expect(logger).toBeInstanceOf(ConsoleLogger);
    });

    it('captures every level regardless of NEST_LOG_LEVEL', () => {
      vi.stubEnv('NEST_LOG_LEVEL', 'error');
      const local = new CapturingLogger();

      local.debug('captured');

      expect(local.entries).toHaveLength(1);
    });

    it('honours explicit log levels', () => {
      const local = new CapturingLogger({ logLevels: ['warn'] });

      local.log('hidden');
      local.warn('shown');
      local.error('shown');

      expect(local.entries.map(entry => entry.level)).toEqual([
        'warn',
        'error',
      ]);
    });
  });

  describe('capture', () => {
    it.each(['verbose', 'debug', 'log', 'warn', 'fatal'] as const)(
      'records a %s call',
      level => {
        logger[level]('hello');

        expect(logger.entries).toEqual([
          { level, message: 'hello', args: ['hello'] },
        ]);
      },
    );

    it('records structured context and params', () => {
      logger.log('Order created', { orderId: 1 }, { userId: 2 }, 'Orders');

      expect(logger.entries[0]).toEqual({
        level: 'log',
        message: 'Order created',
        context: 'Orders',
        params: { orderId: 1, userId: 2 },
        args: ['Order created', { orderId: 1 }, { userId: 2 }, 'Orders'],
      });
    });

    it('records a non-string message', () => {
      logger.warn({ retries: 3 });

      expect(logger.entries[0]).toEqual({
        level: 'warn',
        message: { retries: 3 },
        args: [{ retries: 3 }],
      });
    });

    it('uses the message of an error passed as the message', () => {
      const error = new Error('Payment failed');

      logger.error(error);

      expect(logger.entries[0]).toMatchObject({
        level: 'error',
        message: 'Payment failed',
        error,
      });
    });

    it('extracts an error passed after the message', () => {
      const error = new Error('declined');

      logger.error('Payment failed', error, 'Payments');

      expect(logger.entries[0]).toMatchObject({
        level: 'error',
        message: 'Payment failed',
        context: 'Payments',
        error,
      });
    });

    it.each([
      [['boom', 'Error: boom\n    at run (app.ts:1:1)', 'App'], 'App'],
      [['boom', 'Error: boom\n    at run (app.ts:1:1)'], undefined],
    ])('records a stack passed as a string', (args, context) => {
      logger.error(...args);

      expect(logger.entries[0]).toMatchObject({
        message: 'boom',
        stack: args[1],
        ...(context ? { context } : {}),
      });
    });

    it('evaluates a lazy message', () => {
      logger.debug(() => 'expensive');

      expect(logger.entries[0].message).toBe('expensive');
    });

    it('does not print by default', () => {
      logger.log('message');
      logger.error('message');

      expect(stdoutSpy).not.toHaveBeenCalled();
      expect(stderrSpy).not.toHaveBeenCalled();
    });

    it('prints structured json when enabled', () => {
      const local = new CapturingLogger({ print: true, json: true });

      local.log('Order created', { orderId: 1 }, 'Orders');
      local.error('Failed', new Error('boom'));

      expect(local.entries).toHaveLength(2);
      expect(JSON.parse(stdoutSpy.mock.calls[0][0] as string)).toMatchObject({
        level: 'log',
        message: 'Order created',
        context: 'Orders',
        params: { orderId: 1 },
      });
      expect(JSON.parse(stderrSpy.mock.calls[0][0] as string)).toMatchObject({
        level: 'error',
        message: 'Failed',
        error: { message: 'boom' },
      });
    });

    it('prints a stack passed as a string in text mode', () => {
      const local = new CapturingLogger({ print: true, colors: false });
      const stack = 'Error: boom\n    at run (app.ts:1:1)';

      local.error('boom', stack, 'App');

      expect(stderrSpy).toHaveBeenCalledTimes(2);
      expect(stderrSpy.mock.calls[0][0]).toContain('[App] boom');
      expect(stderrSpy.mock.calls[1][0]).toBe(`${stack}\n`);
    });

    it('evaluates a lazy message once while printing', () => {
      const local = new CapturingLogger({ print: true, json: true });
      const message = vi.fn(() => 'expensive');

      local.debug(message);

      expect(message).toHaveBeenCalledOnce();
      expect(local.entries[0].message).toBe('expensive');
      expect(JSON.parse(stdoutSpy.mock.calls[0][0] as string).message).toBe(
        'expensive',
      );
    });

    it('returns a snapshot of the entries', () => {
      logger.log('first');
      const entries = logger.entries;
      logger.log('second');

      expect(entries).toHaveLength(1);
      expect(logger.entries).toHaveLength(2);
    });

    it('clears the entries', () => {
      logger.log('message');

      logger.clear();

      expect(logger.entries).toEqual([]);
    });
  });

  describe('filter and find', () => {
    beforeEach(() => {
      seedLogs(logger);
    });

    it('filters by level', () => {
      expect(logger.filter({ level: 'log' })).toHaveLength(3);
    });

    it('matches a string context exactly', () => {
      expect(logger.filter({ context: 'Payments' })).toHaveLength(2);
      expect(logger.filter({ context: 'Payment' })).toHaveLength(0);
    });

    it('matches a context regular expression', () => {
      expect(logger.filter({ context: /^Pay/ })).toHaveLength(2);
      expect(logger.filter({ context: /Orders/ })).toHaveLength(1);
      expect(logger.filter({ context: /Missing/ })).toHaveLength(0);
    });

    it('matches a string message as a substring', () => {
      expect(logger.filter({ message: 'Retrying' })).toHaveLength(1);
      expect(logger.filter({ message: 'PAYMENT' })).toHaveLength(0);
    });

    it('matches a message regular expression', () => {
      expect(logger.filter({ message: /payment/i })).toHaveLength(2);
    });

    it('does not match non-string messages', () => {
      expect(logger.filter({ message: 'shape' })).toHaveLength(0);
    });

    it('matches params deeply', () => {
      expect(logger.filter({ params: { orderId: 1 } })).toHaveLength(1);
      expect(logger.filter({ params: { items: [1, 2] } })).toHaveLength(1);
      expect(logger.filter({ params: { orderId: '1' } })).toHaveLength(0);
    });

    it('combines every criterion', () => {
      expect(
        logger.filter({ level: 'error', context: 'Payments' }),
      ).toHaveLength(1);
      expect(logger.filter({ level: 'log', context: 'Payments' })).toEqual([]);
    });

    it('accepts a predicate', () => {
      expect(
        logger.filter(entry => entry.error?.message === 'declined'),
      ).toHaveLength(1);
    });

    it('returns every entry without a matcher', () => {
      expect(logger.filter()).toHaveLength(5);
    });

    it('finds the first matching entry', () => {
      expect(logger.find({ context: 'Payments' })?.level).toBe('warn');
      expect(logger.find({ context: 'Unknown' })).toBeUndefined();
    });
  });

  describe('assertLogged', () => {
    beforeEach(() => {
      seedLogs(logger);
    });

    it('returns the first matching entry', () => {
      const entry = logger.assertLogged({ level: 'error' });

      expect(entry.error?.message).toBe('declined');
    });

    it('lists the captured entries when nothing matches', () => {
      expect(() =>
        logger.assertLogged({ level: 'fatal' }),
      ).toThrowError(/Expected a log entry matching/);

      try {
        logger.assertLogged({ level: 'fatal' });
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('Captured entries:');
        expect(message).toContain('LOG [RouterExplorer] Mapped');
        expect(message).toContain('LOG [Orders] Order created');
        expect(message).toContain('WARN [Payments] Retrying payment');
        expect(message).toContain('ERROR [Payments] Payment failed');
        expect(message).toContain('LOG { shape: true }');
      }
    });

    it('describes a predicate matcher', () => {
      expect(() => logger.assertLogged(() => false)).toThrow(
        'Expected a log entry matching the predicate',
      );
    });

    it('reports when nothing was captured', () => {
      logger.clear();

      expect(() => logger.assertLogged({ level: 'log' })).toThrow(
        "Expected a log entry matching { level: 'log' }, but none of the 0 captured entries matched.",
      );
    });

    it('lists only the last 50 entries', () => {
      logger.clear();
      for (let i = 0; i < 60; i++) {
        logger.log(`message ${i}`);
      }

      expect(() => logger.assertLogged({ level: 'error' })).toThrow(
        '(10 earlier entries omitted)\n  LOG message 10',
      );
    });
  });

  describe('assertNotLogged', () => {
    beforeEach(() => {
      seedLogs(logger);
    });

    it('passes when nothing matches', () => {
      expect(() => logger.assertNotLogged({ level: 'fatal' })).not.toThrow();
    });

    it('lists the matching entries when something matches', () => {
      expect(() => logger.assertNotLogged({ context: 'Payments' })).toThrow(
        [
          "Expected no log entry matching { context: 'Payments' }, but 2 matched.",
          'Captured entries:',
          '  WARN [Payments] Retrying payment (attempt 2)',
          '  ERROR [Payments] Payment failed',
        ].join('\n'),
      );
    });
  });

  describe('as the application logger', () => {
    let previousLogger: LoggerService | undefined;

    beforeEach(() => {
      previousLogger = Logger['staticInstanceRef'];
    });

    afterEach(() => {
      Logger.overrideLogger(previousLogger ?? false);
    });

    it('captures Logger instances and static calls', () => {
      const serviceLogger = new Logger('OrdersService');
      serviceLogger.log('before the override');

      Logger.overrideLogger(logger);
      serviceLogger.log('Order created', { orderId: 1 });
      serviceLogger.error('Order failed', new Error('boom'));
      Logger.warn('static', 'Static');

      expect(logger.entries).toMatchObject([
        {
          level: 'log',
          message: 'Order created',
          context: 'OrdersService',
          params: { orderId: 1 },
        },
        {
          level: 'error',
          message: 'Order failed',
          context: 'OrdersService',
          error: { message: 'boom' },
        },
        { level: 'warn', message: 'static', context: 'Static' },
      ]);
    });

    it('reports its levels through Logger', () => {
      Logger.overrideLogger(new CapturingLogger({ logLevels: ['warn'] }));

      expect(Logger.isLevelEnabled('log')).toBe(false);
      expect(Logger.isLevelEnabled('warn')).toBe(true);
    });
  });
});
