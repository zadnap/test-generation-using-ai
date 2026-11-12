import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsoleLogger } from '../../../../packages/common/services/console-logger.service.js';
import { LOG_LEVELS } from '../../../../packages/common/services/log-levels.constant.js';
import { LOG_LEVEL_ENV_VAR } from '../../../../packages/common/services/utils/get-env-log-levels.util.js';

const ALL_LEVELS = [...LOG_LEVELS];
const STACK = '\n    at fn (file.ts:1:2)';

let stdoutSpy: any;
let stderrSpy: any;
let consoleLogSpy: any;
let consoleErrorSpy: any;

const written = (spy: any) => spy.mock.calls.map(call => String(call[0])).join('');

describe('ConsoleLogger (C3)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    delete process.env[LOG_LEVEL_ENV_VAR];
    delete process.env.NO_COLOR;
    (ConsoleLogger as any).lastTimestampAt = undefined;
    stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((() => true) as any);
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation((() => true) as any);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    delete process.env[LOG_LEVEL_ENV_VAR];
    delete process.env.NO_COLOR;
  });

  describe('constructor', () => {
    it('creates a logger with defaults', () => {
      const logger = new ConsoleLogger();

      expect(logger.options.prefix).toBe('Nest');
      expect(logger.context).toBeUndefined();
      expect(logger.inspectOptions.depth).toBe(5);
      expect(logger.inspectOptions.compact).toBe(false);
    });

    it('accepts a context string', () => {
      const logger = new ConsoleLogger('Ctx');
      expect(logger.context).toBe('Ctx');
      expect(logger.originalContext).toBe('Ctx');
    });

    it('accepts an options object with a context', () => {
      const logger = new ConsoleLogger({ context: 'Ctx', prefix: 'P' });
      expect(logger.context).toBe('Ctx');
      expect(logger.options.prefix).toBe('P');
    });

    it('accepts a context and options', () => {
      const logger = new ConsoleLogger('Ctx', { prefix: 'P' });
      expect(logger.context).toBe('Ctx');
      expect(logger.options.prefix).toBe('P');
    });

    it('accepts options as the second argument', () => {
      const logger = new ConsoleLogger(undefined, { prefix: 'P' });
      expect(logger.context).toBeUndefined();
      expect(logger.options.prefix).toBe('P');
    });

    it('disables colors in JSON mode', () => {
      expect(new ConsoleLogger({ json: true }).options.colors).toBe(false);
    });

    it('honors explicit colors in JSON mode', () => {
      expect(
        new ConsoleLogger({ json: true, colors: true }).options.colors,
      ).toBe(true);
    });

    it('disables colors when NO_COLOR is set', () => {
      vi.stubEnv('NO_COLOR', '1');
      expect(new ConsoleLogger().options.colors).toBe(false);
    });

    it('enables colors when NO_COLOR is empty', () => {
      vi.stubEnv('NO_COLOR', '');
      expect(new ConsoleLogger().options.colors).toBe(true);
    });

    it('creates a redactor from an array of paths', () => {
      const logger = new ConsoleLogger({ redact: ['password'] });
      expect(logger.redact({ password: 'a' })).toEqual({
        password: '[REDACTED]',
      });
    });

    it('creates a redactor from a paths object with a censor', () => {
      const logger = new ConsoleLogger({
        redact: { paths: ['password'], censor: '***' },
      });
      expect(logger.redact({ password: 'a' })).toEqual({ password: '***' });
    });

    it('leaves the redactor undefined when redact is not set', () => {
      const logger = new ConsoleLogger();
      expect(logger.redactor).toBeUndefined();
      const value = { password: 'a' };
      expect(logger.redact(value)).toBe(value);
    });

    it('does not create a redactor when no path is usable', () => {
      const logger = new ConsoleLogger({ redact: { paths: [''] } });
      expect(logger.redactor).toBeUndefined();
    });
  });

  describe('levels', () => {
    it.each(['log', 'error', 'warn', 'debug', 'verbose', 'fatal'] as const)(
      'prints %s when enabled',
      level => {
        const logger = new ConsoleLogger({
          logLevels: ALL_LEVELS,
          forceConsole: true,
        });
        logger[level]('message');
        expect(consoleLogSpy.mock.calls.length + consoleErrorSpy.mock.calls.length)
          .toBeGreaterThan(0);
      },
    );

    it.each(['log', 'error', 'warn', 'debug', 'verbose', 'fatal'] as const)(
      'skips %s when disabled',
      level => {
        const logger = new ConsoleLogger({
          logLevels: [],
          forceConsole: true,
        });
        logger[level]('message');
        expect(consoleLogSpy).not.toHaveBeenCalled();
        expect(consoleErrorSpy).not.toHaveBeenCalled();
      },
    );

    it('uses default levels when none are configured', () => {
      const logger = new ConsoleLogger();
      expect(logger.isLevelEnabled('log')).toBe(true);
      expect(logger.options.logLevels).toEqual([
        'log',
        'error',
        'warn',
        'debug',
        'verbose',
        'fatal',
      ]);
    });

    it('uses the environment levels when configured', () => {
      vi.stubEnv(LOG_LEVEL_ENV_VAR, 'error');
      const logger = new ConsoleLogger();
      expect(logger.isLevelEnabled('error')).toBe(true);
      expect(logger.isLevelEnabled('log')).toBe(false);
    });

    it('warns once for an invalid environment value', () => {
      vi.stubEnv(LOG_LEVEL_ENV_VAR, 'invalid-level');
      const warnSpy = vi
        .spyOn(ConsoleLogger.prototype, 'warn')
        .mockImplementation(() => undefined);

      const first = new ConsoleLogger();
      expect(first.isLevelEnabled('log')).toBe(true);
      expect(warnSpy).toHaveBeenCalledTimes(1);

      const second = new ConsoleLogger();
      expect(second.isLevelEnabled('log')).toBe(true);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('sets log levels on an existing options object', () => {
      const logger = new ConsoleLogger();
      logger.setLogLevels(['error']);
      expect(logger.options.logLevels).toEqual(['error']);
    });

    it('sets log levels even when options were removed', () => {
      const logger = new ConsoleLogger();
      (logger as any).options = undefined;
      logger.setLogLevels(['error']);
      expect(logger.options.logLevels).toEqual(['error']);
    });

    it('updates and resets the context', () => {
      const logger = new ConsoleLogger('Original');
      logger.setContext('Other');
      expect(logger.context).toBe('Other');
      logger.resetContext();
      expect(logger.context).toBe('Original');
    });
  });

  describe('text output', () => {
    it('formats a simple message', () => {
      const logger = new ConsoleLogger({ logLevels: ALL_LEVELS });
      logger.log('message');
      expect(written(stdoutSpy)).toContain('message');
    });

    it('uses the configured prefix', () => {
      const logger = new ConsoleLogger({ logLevels: ALL_LEVELS, prefix: 'P' });
      logger.log('message');
      expect(written(stdoutSpy)).toContain('[P]');
    });

    it('formats contexts with and without colors', () => {
      const plain = new ConsoleLogger('Ctx', {
        logLevels: ALL_LEVELS,
        colors: false,
      });
      plain.log('message');
      expect(written(stdoutSpy)).toContain('[Ctx]');
      expect(written(stdoutSpy)).not.toContain('\x1B[38;5;3m');

      const colored = new ConsoleLogger('Ctx', {
        logLevels: ALL_LEVELS,
        colors: true,
      });
      colored.log('message');
      expect(written(stdoutSpy)).toContain('\x1B[38;5;3m');
    });

    it('writes error output to stderr', () => {
      const logger = new ConsoleLogger({ logLevels: ALL_LEVELS });
      logger.error('failure');
      expect(written(stderrSpy)).toContain('failure');
    });

    it('uses console output when forceConsole is enabled', () => {
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        forceConsole: true,
      });
      logger.log('message');
      logger.error('failure');
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('defaults to stdout when no stream type is given', () => {
      const logger = new ConsoleLogger({ logLevels: ALL_LEVELS });
      (logger as any).printMessages(['message']);
      expect(written(stdoutSpy)).toContain('message');
    });

    it('prints the stack trace to stderr', () => {
      const logger = new ConsoleLogger({ logLevels: ALL_LEVELS });
      logger.error('failure', STACK);
      expect(written(stderrSpy)).toContain(STACK.trim());
    });

    it('prints the stack trace with forceConsole', () => {
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        forceConsole: true,
      });
      logger.error('failure', STACK);
      expect(consoleErrorSpy).toHaveBeenCalledWith(STACK);
    });

    it('skips the stack trace in JSON mode', () => {
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        json: true,
      });
      (logger as any).printStackTrace(STACK);
      expect(stderrSpy).not.toHaveBeenCalled();
    });

    it('prints timestamp differences', () => {
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        timestamp: true,
      });
      logger.log('first');
      logger.log('second');
      expect(written(stdoutSpy)).toContain(' +');
    });

    it('formats colored timestamp differences', () => {
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        timestamp: true,
        colors: true,
      });
      logger.log('first');
      logger.log('second');
      expect(written(stdoutSpy)).toContain('\x1B[38;5;3m +');
    });

    it('formats uncolored timestamp differences', () => {
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        timestamp: true,
        colors: false,
      });
      logger.log('first');
      logger.log('second');
      expect(written(stdoutSpy)).toContain(' +');
      expect(written(stdoutSpy)).not.toContain('\x1B[38;5;3m');
    });

    it('does not print a timestamp difference without the option', () => {
      const logger = new ConsoleLogger({ logLevels: ALL_LEVELS });
      logger.log('first');
      logger.log('second');
      expect(written(stdoutSpy)).not.toContain(' +');
    });

    it('skips timestamp differences when no previous timestamp exists', () => {
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        timestamp: true,
      });
      expect((logger as any).updateAndGetTimestampDiff()).toBe('');
    });

    it('prints structured params', () => {
      const logger = new ConsoleLogger({ logLevels: ALL_LEVELS });
      logger.log('message', { userId: 1 });
      expect(written(stdoutSpy)).toContain('userId');
    });

    it('prints multiple messages', () => {
      const logger = new ConsoleLogger({ logLevels: ALL_LEVELS });
      logger.log('message', 'extra', { userId: 1 });
      expect(written(stdoutSpy)).toContain('extra');
      expect(written(stdoutSpy)).toContain('userId');
    });
  });

  describe('message resolution', () => {
    it('resolves a class to its name', () => {
      class CustomClass {}
      const logger = new ConsoleLogger({ logLevels: ALL_LEVELS });
      logger.log(CustomClass);
      expect(written(stdoutSpy)).toContain('CustomClass');
    });

    it('resolves a lazy function', () => {
      const logger = new ConsoleLogger({ logLevels: ALL_LEVELS });
      logger.log(() => 'lazy');
      expect(written(stdoutSpy)).toContain('lazy');
    });

    it('resolves nested lazy functions', () => {
      const logger = new ConsoleLogger({ logLevels: ALL_LEVELS });
      logger.log(() => () => 'nested');
      expect(written(stdoutSpy)).toContain('nested');
    });

    it('formats strings, plain objects, arrays and other values', () => {
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        colors: true,
      });
      logger.log('string');
      logger.log({ a: 1 });
      logger.log([1, 2]);
      logger.log(new Map([['a', 1]]));
      logger.log(42);

      const output = written(stdoutSpy);
      expect(output).toContain('string');
      expect(output).toContain('Object(1)');
      expect(output).toContain('Array(2)');
      expect(output).toContain('42');
    });
  });

  describe('colors', () => {
    it.each(['debug', 'warn', 'error', 'verbose', 'fatal', 'log'] as const)(
      'colorizes %s',
      level => {
        const logger = new ConsoleLogger({
          logLevels: ALL_LEVELS,
          colors: true,
        });
        logger[level](`${level}-message`);
        expect(written(stdoutSpy) + written(stderrSpy)).toContain('\x1B[');
      },
    );

    it('does not colorize in JSON mode', () => {
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        colors: true,
        json: true,
      });
      expect((logger as any).colorize('message', 'log')).toBe('message');
    });
  });

  describe('context and messages', () => {
    it('handles a single argument', () => {
      const logger = new ConsoleLogger('Ctx', { logLevels: ALL_LEVELS });
      expect((logger as any).getContextAndMessagesToPrint(['message'])).toEqual({
        messages: ['message'],
        context: 'Ctx',
      });
    });

    it('handles no arguments', () => {
      const logger = new ConsoleLogger('Ctx', { logLevels: ALL_LEVELS });
      expect((logger as any).getContextAndMessagesToPrint([])).toEqual({
        messages: [],
        context: 'Ctx',
      });
    });

    it('takes a trailing string as the context', () => {
      const logger = new ConsoleLogger({ logLevels: ALL_LEVELS });
      expect(
        (logger as any).getContextAndMessagesToPrint(['message', 'Other']),
      ).toEqual({ messages: ['message'], context: 'Other' });
    });

    it('keeps the logger context when the last argument is not a string', () => {
      const logger = new ConsoleLogger('Ctx', { logLevels: ALL_LEVELS });
      expect(
        (logger as any).getContextAndMessagesToPrint(['message', 1]),
      ).toEqual({ messages: ['message', 1], context: 'Ctx' });
    });

    it('does not extract params when structuredParams is false', () => {
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        structuredParams: false,
      });
      expect(
        (logger as any).getContextAndMessagesToPrint([
          'message',
          { userId: 1 },
        ]),
      ).toEqual({
        messages: ['message', { userId: 1 }],
        context: undefined,
      });
    });

    it('merges several plain objects into params', () => {
      const logger = new ConsoleLogger({ logLevels: ALL_LEVELS });
      expect(
        (logger as any).getContextAndMessagesToPrint([
          'message',
          { a: 1 },
          'extra',
          { b: 2 },
        ]),
      ).toEqual({
        messages: ['message', 'extra'],
        context: undefined,
        params: { a: 1, b: 2 },
      });
    });

    it('keeps the message object out of params', () => {
      const logger = new ConsoleLogger({ logLevels: ALL_LEVELS });
      expect(
        (logger as any).getContextAndMessagesToPrint([{ a: 1 }, { b: 2 }]),
      ).toEqual({
        messages: [{ a: 1 }],
        context: undefined,
        params: { b: 2 },
      });
    });

    it('returns undefined params when no plain object follows the message', () => {
      const logger = new ConsoleLogger({ logLevels: ALL_LEVELS });
      expect(
        (logger as any).getContextAndMessagesToPrint(['message', 1, 2]),
      ).toEqual({
        messages: ['message', 1, 2],
        context: undefined,
        params: undefined,
      });
    });
  });

  describe('context, stack and messages', () => {
    it('handles a single argument', () => {
      const logger = new ConsoleLogger('Ctx', { logLevels: ALL_LEVELS });
      expect(
        (logger as any).getContextAndStackAndMessagesToPrint(['message']),
      ).toEqual({ messages: ['message'], context: 'Ctx' });
    });

    it('treats a stack-formatted second argument as the stack', () => {
      const logger = new ConsoleLogger('Ctx', { logLevels: ALL_LEVELS });
      expect(
        (logger as any).getContextAndStackAndMessagesToPrint(['message', STACK]),
      ).toEqual({ messages: ['message'], stack: STACK, context: 'Ctx' });
    });

    it('treats an undefined second argument as the stack', () => {
      const logger = new ConsoleLogger('Ctx', { logLevels: ALL_LEVELS });
      expect(
        (logger as any).getContextAndStackAndMessagesToPrint([
          'message',
          undefined,
        ]),
      ).toEqual({ messages: ['message'], stack: undefined, context: 'Ctx' });
    });

    it('treats a non-stack second argument as a context', () => {
      const logger = new ConsoleLogger({ logLevels: ALL_LEVELS });
      expect(
        (logger as any).getContextAndStackAndMessagesToPrint([
          'message',
          'Other',
        ]),
      ).toEqual({ messages: ['message'], context: 'Other' });
    });

    it('extracts a trailing stack with more than two arguments', () => {
      const logger = new ConsoleLogger({ logLevels: ALL_LEVELS });
      expect(
        (logger as any).getContextAndStackAndMessagesToPrint([
          'message',
          { userId: 1 },
          STACK,
        ]),
      ).toEqual({
        messages: ['message'],
        context: undefined,
        stack: STACK,
        params: { userId: 1 },
      });
    });

    it('returns early when only the message remains', () => {
      const logger = new ConsoleLogger({ logLevels: ALL_LEVELS });
      expect(
        (logger as any).getContextAndStackAndMessagesToPrint([
          'message',
          { userId: 1 },
          'Other',
        ]),
      ).toEqual({
        messages: ['message'],
        context: 'Other',
        params: { userId: 1 },
      });
    });

    it('treats a trailing string message as the stack', () => {
      const logger = new ConsoleLogger({ logLevels: ALL_LEVELS });
      expect(
        (logger as any).getContextAndStackAndMessagesToPrint([
          'message',
          'stack-like',
          'Other',
        ]),
      ).toEqual({
        messages: ['message'],
        stack: 'stack-like',
        context: 'Other',
        params: undefined,
      });
    });

    it('treats an undefined trailing message as the stack', () => {
      const logger = new ConsoleLogger('Ctx', { logLevels: ALL_LEVELS });
      expect(
        (logger as any).getContextAndStackAndMessagesToPrint([
          'message',
          'Other',
          undefined,
        ]),
      ).toEqual({
        messages: ['message', 'Other'],
        stack: undefined,
        context: 'Ctx',
        params: undefined,
      });
    });

    it('returns messages when the last message is neither a stack nor undefined', () => {
      const logger = new ConsoleLogger({ logLevels: ALL_LEVELS });
      expect(
        (logger as any).getContextAndStackAndMessagesToPrint([
          'message',
          'Other',
          1,
        ]),
      ).toEqual({
        messages: ['message', 'Other', 1],
        context: undefined,
        params: undefined,
      });
    });

    it.each([
      [undefined, false],
      [1, false],
      ['', false],
      ['plain string', false],
      ['\nat fn:1:2', false],
      ['\n    at fn:1:2', true],
      ['\n\tat fn (file.ts:1:2)', true],
      ['line\n   at x:10:20', true],
    ])('detects stack format in %j', (value, expected) => {
      const logger = new ConsoleLogger({ logLevels: ALL_LEVELS });
      expect((logger as any).isStackFormat(value)).toBe(expected);
    });
  });

  describe('inspect options', () => {
    it.each([
      [{ breakLength: 10 }, 10],
      [{ colors: true, compact: true }, Infinity],
      [{ colors: true, compact: false }, undefined],
      [{ colors: true }, undefined],
      [{ colors: false, compact: false }, undefined],
      [{ colors: false, compact: true }, Infinity],
      [{ colors: false }, Infinity],
    ])('computes breakLength for %j', (options, expected) => {
      const logger = new ConsoleLogger(options as any);
      expect(logger.inspectOptions.breakLength).toBe(expected);
    });

    it('uses the default depth', () => {
      expect(new ConsoleLogger().inspectOptions.depth).toBe(5);
    });

    it('accepts a custom depth', () => {
      expect(new ConsoleLogger({ depth: null }).inspectOptions.depth).toBeNull();
      expect(new ConsoleLogger({ depth: 2 }).inspectOptions.depth).toBe(2);
    });

    it('forwards sorted, showHidden and compact', () => {
      const sorted = (a: string, b: string) => a.localeCompare(b);
      const logger = new ConsoleLogger({
        sorted,
        showHidden: true,
        compact: 3,
      });
      expect(logger.inspectOptions.sorted).toBe(sorted);
      expect(logger.inspectOptions.showHidden).toBe(true);
      expect(logger.inspectOptions.compact).toBe(3);
    });

    it('forwards array and string length limits', () => {
      const logger = new ConsoleLogger({
        maxArrayLength: 3,
        maxStringLength: 4,
      });
      expect(logger.inspectOptions.maxArrayLength).toBe(3);
      expect(logger.inspectOptions.maxStringLength).toBe(4);
    });

    it('omits length limits when they are undefined', () => {
      const logger = new ConsoleLogger();
      expect('maxArrayLength' in logger.inspectOptions).toBe(false);
      expect('maxStringLength' in logger.inspectOptions).toBe(false);
    });
  });

  describe('JSON output', () => {
    it('serializes a simple record', () => {
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        json: true,
      });
      logger.log('message', 'Ctx');
      const output = written(stdoutSpy);
      expect(output).toContain('"level":"log"');
      expect(output).toContain('"message":"message"');
      expect(output).toContain('"context":"Ctx"');
    });

    it('uses inspect when colors are enabled', () => {
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        json: true,
        colors: true,
      });
      logger.log('message');
      expect(written(stdoutSpy)).toContain('{ level:');
    });

    it('uses inspect when compact is not true', () => {
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        json: true,
        compact: false,
      });
      logger.log('message');
      expect(written(stdoutSpy)).toContain('level:');
    });

    it('writes JSON errors to stderr', () => {
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        json: true,
        forceConsole: true,
      });
      logger.error('failure');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('writes JSON to console when forced', () => {
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        json: true,
        forceConsole: true,
      });
      logger.log('message');
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('defaults to stdout when no JSON stream type is given', () => {
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        json: true,
      });
      (logger as any).printMessages(['message']);
      expect(written(stdoutSpy)).toContain('"message":"message"');
    });

    it('adds an error stack', () => {
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        json: true,
      });
      logger.error('failure', STACK);
      expect(written(stderrSpy)).toContain('"stack"');
    });

    it('handles an error passed as the message', () => {
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        json: true,
      });
      logger.log(new Error('boom'));
      expect(written(stdoutSpy)).toContain('"error"');
      expect(written(stdoutSpy)).toContain('"message":"boom"');
    });

    it('extracts an error passed after the message', () => {
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        json: true,
      });
      logger.log('message', new Error('boom'));
      expect(written(stdoutSpy)).toContain('"error"');
    });

    it('attaches the error only to the first JSON record', () => {
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        json: true,
      });
      logger.log('first', 'second', new Error('boom'));
      const output = written(stdoutSpy);
      expect(output).toContain('"message":"first"');
      expect(output).toContain('"message":"second"');
    });

    it('nests params by default', () => {
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        json: true,
      });
      logger.log('message', { userId: 1 });
      expect(written(stdoutSpy)).toContain('"params":{"userId":1}');
    });

    it('flattens params without overriding framework fields', () => {
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        json: true,
        flattenParams: true,
      });
      logger.log('message', {
        userId: 1,
        level: 'debug',
        message: 'override',
      });
      const output = written(stdoutSpy);
      expect(output).toContain('"userId":1');
      expect(output).toContain('"level":"log"');
      expect(output).toContain('"message":"message"');
    });

    it('does not flatten params when flattenParams is false', () => {
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        json: true,
        flattenParams: false,
      });
      logger.log('message', { userId: 1 });
      expect(written(stdoutSpy)).toContain('"params":{"userId":1}');
    });

    it('serializes nested error causes and aggregate errors', () => {
      const cause = Object.assign(new Error('cause'), { code: 'A' });
      const inner = Object.assign(new Error('inner'), { code: 'B' });
      const error = new AggregateError([inner], 'outer', { cause });
      (error as any).extra = 'value';

      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        json: true,
      });
      logger.log(error);
      const output = written(stdoutSpy);
      expect(output).toContain('"cause"');
      expect(output).toContain('"errors"');
      expect(output).toContain('"extra":"value"');
    });

    it('serializes non-error causes as values', () => {
      const error = new Error('outer');
      (error as any).cause = { id: 1 };
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        json: true,
      });
      logger.log(error);
      expect(written(stdoutSpy)).toContain('"cause":{"id":1}');
    });

    it('handles circular error causes', () => {
      const error = new Error('outer');
      (error as any).cause = error;
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        json: true,
      });
      logger.log(error);
      expect(written(stdoutSpy)).toContain('[Circular]');
    });

    it('truncates nested errors past the maximum depth', () => {
      let error: any = new Error('leaf');
      for (let i = 0; i < 7; i++) {
        error = new Error(`level-${i}`, { cause: error });
      }
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        json: true,
      });
      logger.log(error);
      expect(written(stdoutSpy)).toContain('[Truncated]');
    });

    it('replaces circular structures with [Circular]', () => {
      const params: any = { id: 1 };
      params.self = params;
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        json: true,
      });
      logger.log('message', params);
      expect(written(stdoutSpy)).toContain('[Circular]');
    });

    it('replaces a shared circular sibling branch', () => {
      const shared: any = { id: 1 };
      const params = { a: shared, b: shared } as any;
      params.a.parent = shared;
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        json: true,
      });
      logger.log('message', params);
      expect(written(stdoutSpy)).toContain('[Circular]');
    });

    it('serializes bigint and symbol values', () => {
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        json: true,
      });
      logger.log('message', { big: 10n, symbol: Symbol('x') });
      const output = written(stdoutSpy);
      expect(output).toContain('"big":"10"');
      expect(output).toContain('"symbol":"Symbol(x)"');
    });

    it('serializes maps, sets and errors in params', () => {
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        json: true,
      });
      logger.log('message', {
        map: new Map([['a', 1]]),
        set: new Set([1]),
        error: new Error('nested'),
      });
      const output = written(stdoutSpy);
      expect(output).toContain('Map');
      expect(output).toContain('Set');
      expect(output).toContain('Error');
    });

    it('truncates records past the maximum length', () => {
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        json: true,
      });
      logger.log('message', {
        huge: 'x'.repeat(1_000_010),
        object: { id: 1 },
        number: 1,
      });
      expect(written(stdoutSpy)).toContain('[Truncated]');
    });

    it('falls back to inspect when serialization throws', () => {
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        json: true,
      });
      const params = {
        toJSON() {
          throw new Error('nope');
        },
      };
      logger.log('message', params);
      expect(written(stdoutSpy)).toContain('message');
    });

    it('redacts messages and params', () => {
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        json: true,
        redact: ['password'],
      });
      logger.log({ password: 'a' }, { password: 'b' });
      const output = written(stdoutSpy);
      expect(output).not.toContain('"a"');
      expect(output).not.toContain('"b"');
      expect(output).toContain('[REDACTED]');
    });
  });

  describe('redaction', () => {
    it('redacts text messages and params', () => {
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        redact: ['password'],
      });
      logger.log({ user: { password: 'a' } }, { password: 'b' });
      const output = written(stdoutSpy);
      expect(output).toContain('[REDACTED]');
      expect(output).not.toContain("password: 'a'");
    });

    it('does not redact string message contents', () => {
      const logger = new ConsoleLogger({
        logLevels: ALL_LEVELS,
        redact: ['password'],
      });
      logger.log('password is secret');
      expect(written(stdoutSpy)).toContain('password is secret');
    });
  });
});
