import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ConsoleLogger,
} from '../../../../packages/common/services/console-logger.service.js';
import { LOG_LEVEL_ENV_VAR } from '../../../../packages/common/services/utils/get-env-log-levels.util.js';
import { clc } from '../../../../packages/common/utils/cli-colors.util.js';

const originalEnv = process.env[LOG_LEVEL_ENV_VAR];
const restoreEnv = () => {
  if (originalEnv === undefined) delete process.env[LOG_LEVEL_ENV_VAR];
  else process.env[LOG_LEVEL_ENV_VAR] = originalEnv;
  delete process.env.NO_COLOR;
};
afterEach(restoreEnv);

const logger = (opts: any = {}) => new ConsoleLogger(opts);

describe('ConsoleLogger', () => {
  describe('constructor', () => {
    it('applies defaults without arguments', () => {
      const instance: any = new ConsoleLogger();
      expect(instance.options.prefix).toBe('Nest');
      expect(instance.options.colors).toBe(true);
      expect(instance.context).toBeUndefined();
    });

    it('accepts a context string', () => {
      const instance: any = new ConsoleLogger('Ctx');
      expect(instance.context).toBe('Ctx');
      expect(instance.originalContext).toBe('Ctx');
    });

    it('accepts an options object', () => {
      const instance: any = new ConsoleLogger({ prefix: 'P', colors: false });
      expect(instance.options.prefix).toBe('P');
      expect(instance.options.colors).toBe(false);
    });

    it('accepts a context and options together', () => {
      const instance: any = new ConsoleLogger('Ctx', { timestamp: true });
      expect(instance.context).toBe('Ctx');
      expect(instance.options.timestamp).toBe(true);
    });

    it('disables colors in json mode unless set explicitly', () => {
      expect((new ConsoleLogger({ json: true }) as any).options.colors).toBe(
        false,
      );
      expect(
        (new ConsoleLogger({ json: true, colors: true }) as any).options.colors,
      ).toBe(true);
    });

    it('creates a redactor for array and object options', () => {
      expect((new ConsoleLogger({ redact: ['password'] }) as any).redactor).toBeTypeOf(
        'function',
      );
      expect(
        (
          new ConsoleLogger({
            redact: { paths: ['password'], censor: '***' },
          }) as any
        ).redactor,
      ).toBeTypeOf('function');
    });

    it('honours NO_COLOR when colors are not set', () => {
      process.env.NO_COLOR = '1';
      expect((new ConsoleLogger() as any).options.colors).toBe(false);
    });
  });

  describe('levels and context', () => {
    it('uses explicit log levels', () => {
      const instance = new ConsoleLogger({ logLevels: ['error'] });
      expect(instance.isLevelEnabled('log')).toBe(false);
      expect(instance.isLevelEnabled('error')).toBe(true);
    });

    it('falls back to the default levels', () => {
      delete process.env[LOG_LEVEL_ENV_VAR];
      const instance = new ConsoleLogger();
      expect(instance.isLevelEnabled('verbose')).toBe(true);
    });

    it('uses valid environment levels', () => {
      process.env[LOG_LEVEL_ENV_VAR] = 'error';
      expect(new ConsoleLogger().isLevelEnabled('log')).toBe(false);
      expect(new ConsoleLogger().isLevelEnabled('fatal')).toBe(true);
    });

    it('warns once about an invalid environment value', () => {
      process.env[LOG_LEVEL_ENV_VAR] = 'nope';
      const instance: any = new ConsoleLogger();
      const warn = vi.spyOn(instance, 'warn').mockImplementation(() => undefined);
      expect(instance.getDefaultLogLevels()).toEqual([
        'log',
        'error',
        'warn',
        'debug',
        'verbose',
        'fatal',
      ]);
      expect(warn).toHaveBeenCalled();
      instance.getDefaultLogLevels();
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('sets, updates and resets the context', () => {
      const instance = new ConsoleLogger('Original');
      instance.setContext('Other');
      expect((instance as any).context).toBe('Other');
      instance.resetContext();
      expect((instance as any).context).toBe('Original');
    });

    it('sets levels even when options are missing', () => {
      const instance: any = new ConsoleLogger();
      instance.options = undefined;
      instance.setLogLevels(['warn']);
      expect(instance.options.logLevels).toEqual(['warn']);
    });

    it('returns a formatted timestamp', () => {
      expect(typeof (new ConsoleLogger() as any).getTimestamp()).toBe('string');
    });
  });

  describe('formatting helpers', () => {
    it('formats the pid prefix', () => {
      expect((logger({ prefix: 'Nest' }) as any).formatPid(1)).toBe(
        '[Nest] 1  - ',
      );
    });

    it('formats contexts with and without colors', () => {
      expect((logger({ colors: false }) as any).formatContext('')).toBe('');
      expect((logger({ colors: false }) as any).formatContext('Ctx')).toBe(
        '[Ctx] ',
      );
      expect((logger({ colors: true }) as any).formatContext('Ctx')).toContain(
        '[Ctx]',
      );
    });

    it('formats a message line', () => {
      const instance: any = logger({ colors: false });
      const formatted = instance.formatMessage(
        'log',
        'hello',
        '[Nest] 1  - ',
        '   LOG',
        '[Ctx] ',
        '',
        { a: 1 },
      );
      expect(formatted).toContain('hello');
      expect(formatted).toContain('{ a: 1 }');
      expect(formatted.endsWith('\n')).toBe(true);
    });

    it('stringifies params compactly', () => {
      const output = (logger({ colors: false }) as any).stringifyParams({
        a: 1,
        b: [2],
      });
      expect(output).toBe('{ a: 1, b: [ 2 ] }');
    });

    it('resolves classes and lazy functions', () => {
      const instance: any = logger();
      class Message {}
      expect(instance.resolveMessage(Message)).toBe('Message');
      expect(instance.resolveMessage(() => 'lazy')).toBe('lazy');
      expect(instance.resolveMessage(() => () => 'nested')).toBe('nested');
      expect(instance.resolveMessage('plain')).toBe('plain');
    });

    it('stringifies strings, objects, arrays and other values', () => {
      const instance: any = logger({ colors: false });
      expect(instance.stringifyMessage('x', 'log')).toBe('x');
      expect(instance.stringifyMessage({ a: 1 }, 'log')).toContain('Object(1)');
      expect(instance.stringifyMessage([1], 'log')).toContain('Array(1)');
      expect(instance.stringifyMessage(1, 'log')).toBe('1');
    });

    it('colorizes only when colors are enabled and json is off', () => {
      expect((logger({ colors: false }) as any).colorize('x', 'log')).toBe('x');
      expect((logger({ json: true, colors: true }) as any).colorize('x', 'log')).toBe(
        'x',
      );
      expect((logger({ colors: true }) as any).colorize('x', 'log')).toContain(
        '\x1B[',
      );
    });

    it.each([
      ['debug', 'magentaBright'],
      ['warn', 'yellow'],
      ['error', 'red'],
      ['verbose', 'cyanBright'],
      ['fatal', 'bold'],
      ['log', 'green'],
    ])('maps %s to a colorizer', (level, expected) => {
      const instance: any = logger({ colors: true });
      expect(instance.getColorByLogLevel(level)).toBe(
        (clc as any)[expected],
      );
    });
  });

  describe('inspect options', () => {
    it('uses defaults', () => {
      const options = (logger({ colors: false }) as any).getInspectOptions();
      expect(options.depth).toBe(5);
      expect(options.compact).toBe(false);
      expect(options.breakLength).toBe(Infinity);
    });

    it('honours explicit breakLength, depth and lengths', () => {
      const options = (
        logger({
          colors: true,
          compact: true,
          breakLength: 10,
          depth: null,
          maxArrayLength: 2,
          maxStringLength: 3,
        }) as any
      ).getInspectOptions();
      expect(options.breakLength).toBe(10);
      expect(options.depth).toBeNull();
      expect(options.maxArrayLength).toBe(2);
      expect(options.maxStringLength).toBe(3);
    });

    it('derives breakLength from colors and compact', () => {
      expect(
        (logger({ colors: true, compact: true }) as any).getInspectOptions()
          .breakLength,
      ).toBe(Infinity);
      expect(
        (logger({ colors: true, compact: false }) as any).getInspectOptions()
          .breakLength,
      ).toBeUndefined();
      expect(
        (logger({ colors: false, compact: false }) as any).getInspectOptions()
          .breakLength,
      ).toBeUndefined();
    });

    it('defaults json compact to true', () => {
      expect(
        (logger({ json: true }) as any).getInspectOptions().compact,
      ).toBe(true);
    });
  });

  describe('printMessages', () => {
    it('writes to stdout through the process stream', () => {
      const instance: any = logger({ colors: false });
      const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      instance.printMessages(['hello'], 'Ctx', 'log');
      expect(write).toHaveBeenCalled();
      write.mockRestore();
    });

    it('writes to stderr through the process stream', () => {
      const instance: any = logger({ colors: false });
      const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
      instance.printMessages(['hello'], 'Ctx', 'error', 'stderr');
      expect(write).toHaveBeenCalled();
      write.mockRestore();
    });

    it('uses the console when forceConsole is enabled', () => {
      const instance: any = logger({ colors: false, forceConsole: true });
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      instance.printMessages(['hello'], 'Ctx', 'log');
      instance.printMessages(['bad'], 'Ctx', 'error', 'stderr');
      expect(log).toHaveBeenCalled();
      expect(error).toHaveBeenCalled();
      log.mockRestore();
      error.mockRestore();
    });

    it('redacts messages and params when a redactor exists', () => {
      const instance: any = logger({
        colors: false,
        json: true,
        redact: ['password'],
      });
      const printAsJson = vi
        .spyOn(instance, 'printAsJson')
        .mockImplementation(() => undefined);
      instance.printMessages([{ password: 'x' }], 'Ctx', 'log', 'stdout', undefined, {
        password: 'y',
      });
      expect(printAsJson).toHaveBeenCalledWith(
        { password: '[REDACTED]' },
        expect.objectContaining({
          params: { password: '[REDACTED]' },
        }),
      );
    });

    it('prints one json record per message', () => {
      const instance: any = logger({ colors: false, json: true });
      const printAsJson = vi
        .spyOn(instance, 'printAsJson')
        .mockImplementation(() => undefined);
      instance.printMessages(['a', 'b'], 'Ctx', 'log');
      expect(printAsJson).toHaveBeenCalledTimes(2);
    });
  });

  describe('json logging', () => {
    it('builds a json log object with optional fields', () => {
      const instance: any = logger({ colors: false });
      const object = instance.getJsonLogObject('msg', {
        context: 'Ctx',
        logLevel: 'log',
        errorStack: 'stack',
        error: new Error('x'),
        params: { a: 1 },
      });
      expect(object).toMatchObject({
        level: 'log',
        message: 'msg',
        context: 'Ctx',
        stack: 'stack',
        params: { a: 1 },
      });
      expect(object.error).toMatchObject({ message: 'x' });
    });

    it('flattens params without clobbering framework fields', () => {
      const instance: any = logger({ colors: false, flattenParams: true });
      const object = instance.getJsonLogObject('msg', {
        logLevel: 'log',
        params: { a: 1, message: 'ignored', level: 'ignored' },
      });
      expect(object.a).toBe(1);
      expect(object.message).toBe('msg');
      expect(object.level).toBe('log');
      expect(object.params).toBeUndefined();
    });

    it('extracts an error from the messages', () => {
      const instance: any = logger();
      const error = new Error('boom');
      expect(instance.extractJsonError(['a', error, 'b'])).toEqual({
        messages: ['a', 'b'],
        error,
      });
      expect(instance.extractJsonError([error, 'b'])).toEqual({
        messages: ['boom', 'b'],
        error,
      });
      expect(instance.extractJsonError(['a'])).toEqual({ messages: ['a'] });
    });

    it('serializes errors including causes and aggregate errors', () => {
      const instance: any = logger();
      const cause = Object.assign(new Error('cause'), { code: 'E' });
      const error: any = Object.assign(new Error('root'), { cause });
      const serialized = instance.serializeError(error);
      expect(serialized.name).toBe('Error');
      expect(serialized.message).toBe('root');
      expect((serialized.cause as any).message).toBe('cause');
      expect((serialized.cause as any).code).toBe('E');

      const aggregate: any = new AggregateError([new Error('a')], 'agg');
      const serializedAggregate = instance.serializeError(aggregate);
      expect((serializedAggregate.errors as any[])[0].message).toBe('a');
    });

    it('handles circular and truncated causes', () => {
      const instance: any = logger();
      const error: any = new Error('root');
      error.cause = error;
      expect(instance.serializeError(error).cause).toBe('[Circular]');

      let deep: any = new Error('leaf');
      for (let i = 0; i < 10; i++) {
        deep = Object.assign(new Error(`level-${i}`), { cause: deep });
      }
      expect(JSON.stringify(instance.serializeError(deep))).toContain(
        '[Truncated]',
      );
    });

    it('stringifies json objects with the replacer', () => {
      const instance: any = logger({ colors: false });
      const output = instance.stringifyJsonLogObject({
        big: BigInt(1),
        sym: Symbol('s'),
        map: new Map([['a', 1]]),
        set: new Set([1]),
        error: new Error('x'),
      });
      expect(output).toContain('"1"');
      expect(output).toContain('Symbol(s)');
      expect(output).toContain('Map(1)');
      expect(output).toContain('Set(1)');
      expect(output).toContain('Error: x');
    });

    it('replaces circular references in json output', () => {
      const instance: any = logger({ colors: false });
      const value: any = { a: 1 };
      value.self = value;
      expect(instance.stringifyJsonLogObject(value)).toContain('[Circular]');
    });

    it('falls back to inspect when json stringification throws', () => {
      const instance: any = logger({ colors: false });
      const value = {
        toJSON() {
          throw new Error('boom');
        },
      };
      expect(() => instance.stringifyJsonLogObject(value)).not.toThrow();
      expect(instance.stringifyJsonLogObject(value)).toContain('toJSON');
    });
  });

  describe('argument parsing', () => {
    it('uses the instance context for a single argument', () => {
      const instance: any = logger();
      instance.context = 'Ctx';
      expect(instance.getContextAndMessagesToPrint(['message'])).toEqual({
        messages: ['message'],
        context: 'Ctx',
      });
    });

    it('treats a trailing string as the context', () => {
      const instance: any = logger();
      expect(instance.getContextAndMessagesToPrint(['message', 'Ctx'])).toEqual({
        messages: ['message'],
        context: 'Ctx',
      });
    });

    it('keeps arguments and uses the instance context otherwise', () => {
      const instance: any = logger();
      instance.context = 'Ctx';
      expect(instance.getContextAndMessagesToPrint(['message', 1])).toEqual({
        messages: ['message', 1],
        context: 'Ctx',
      });
    });

    it('collects plain objects as structured params', () => {
      const instance: any = logger();
      expect(
        instance.getContextAndMessagesToPrint([
          'message',
          { a: 1 },
          { b: 2 },
          3,
        ]),
      ).toEqual({
        messages: ['message', 3],
        context: undefined,
        params: { a: 1, b: 2 },
      });
    });

    it('keeps plain objects as messages when structured params are disabled', () => {
      const instance: any = logger({ structuredParams: false });
      expect(
        instance.getContextAndMessagesToPrint(['message', { a: 1 }]),
      ).toEqual({ messages: ['message', { a: 1 }], context: undefined });
    });

    it('handles a single stack argument', () => {
      const instance: any = logger();
      const stack = 'Error\n    at fn (file.js:1:2)';
      expect(
        instance.getContextAndStackAndMessagesToPrint([stack]),
      ).toMatchObject({ messages: [stack] });
    });

    it('treats a two-argument stack as the stack', () => {
      const instance: any = logger();
      const stack = 'Error\n    at fn (file.js:1:2)';
      expect(
        instance.getContextAndStackAndMessagesToPrint(['message', stack]),
      ).toEqual({ messages: ['message'], stack, context: undefined });
    });

    it('treats an undefined second argument as the stack', () => {
      const instance: any = logger();
      expect(
        instance.getContextAndStackAndMessagesToPrint(['message', undefined]),
      ).toEqual({ messages: ['message'], stack: undefined, context: undefined });
    });

    it('falls back to message parsing for a non-stack second argument', () => {
      const instance: any = logger();
      instance.context = 'Ctx';
      expect(
        instance.getContextAndStackAndMessagesToPrint(['message', 'extra']),
      ).toEqual({ messages: ['message'], context: 'extra' });
    });

    it('extracts a trailing stack from many arguments', () => {
      const instance: any = logger();
      const stack = 'Error\n    at fn (file.js:1:2)';
      expect(
        instance.getContextAndStackAndMessagesToPrint([
          'message',
          'Ctx',
          stack,
        ]),
      ).toEqual({ messages: ['message'], context: 'Ctx', stack, params: undefined });
    });

    it('drops a trailing string stack from parsed messages', () => {
      const instance: any = logger();
      instance.context = 'Ctx';
      expect(
        instance.getContextAndStackAndMessagesToPrint(['message', 'stack']),
      ).toEqual({ messages: ['message'], context: 'stack' });
    });

    it('keeps messages when the last element is not a stack', () => {
      const instance: any = logger();
      instance.context = 'Ctx';
      expect(
        instance.getContextAndStackAndMessagesToPrint(['message', 1, { a: 1 }]),
      ).toEqual({ messages: ['message', 1], context: 'Ctx', params: { a: 1 } });
    });

    it('recognizes stack formats', () => {
      const instance: any = logger();
      expect(instance.isStackFormat(1)).toBe(false);
      expect(instance.isStackFormat(undefined)).toBe(false);
      expect(instance.isStackFormat('plain')).toBe(false);
      expect(instance.isStackFormat('Error\n    at fn (file.js:1:2)')).toBe(true);
    });
  });

  describe('timestamps and stacks', () => {
    it('formats timestamp differences with and without colors', () => {
      expect(
        (logger({ colors: false }) as any).formatTimestampDiff(5),
      ).toBe(' +5ms');
      expect(
        (logger({ colors: true }) as any).formatTimestampDiff(5),
      ).toContain('+5ms');
    });

    it('includes the timestamp difference only when timestamp is enabled', () => {
      const instance: any = logger({ timestamp: false });
      (ConsoleLogger as any).lastTimestampAt = undefined;
      expect(instance.updateAndGetTimestampDiff()).toBe('');

      const withTimestamp: any = logger({ timestamp: true });
      (ConsoleLogger as any).lastTimestampAt = Date.now() - 5;
      expect(withTimestamp.updateAndGetTimestampDiff()).toContain('+');
    });

    it('prints stacks only when present and json is off', () => {
      const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
      const instance: any = logger({ colors: false });
      instance.printStackTrace('');
      instance.printStackTrace('stack');
      expect(write).toHaveBeenCalledWith('stack\n');

      const json: any = logger({ json: true });
      json.printStackTrace('stack');
      expect(write).toHaveBeenCalledTimes(1);
      write.mockRestore();
    });

    it('prints stacks through the console when forceConsole is enabled', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      (logger({ colors: false, forceConsole: true }) as any).printStackTrace(
        'stack',
      );
      expect(error).toHaveBeenCalledWith('stack');
      error.mockRestore();
    });
  });

  describe('redact', () => {
    it('returns the value when no redactor exists', () => {
      const value = { a: 1 };
      expect((logger() as any).redact(value)).toBe(value);
    });

    it('redacts through the configured redactor', () => {
      expect(
        (logger({ redact: ['password'] }) as any).redact({ password: 'x' }),
      ).toEqual({ password: '[REDACTED]' });
    });
  });
});
