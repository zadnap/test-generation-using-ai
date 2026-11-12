import { describe, expect, it, vi } from 'vitest';
import { logLevel } from '../../../../packages/microservices/external/kafka.interface.js';
import { KafkaLogger } from '../../../../packages/microservices/helpers/kafka-logger.js';

/**
 * C3 decisions of KafkaLogger:
 * D1: switch (level) selects the logger method:
 *     ERROR -> 'error', NOTHING -> 'error', WARN -> 'warn', INFO -> 'log',
 *     DEBUG -> 'debug', any other level falls through to default -> 'debug'
 * D2: logger[loggerMethod] truthiness -> T (method called) / F (silently skipped)
 *
 * No infeasible paths: every switch arm and a value outside the enum are
 * reachable, and a logger object may omit any method.
 */

const namespace = 'my-namespace';
const label = 'my-label';
const log = { message: 'hello', extra: { a: 1 }, count: 2 };
const expectedMessage =
  'my-label [my-namespace] hello {"extra":{"a":1},"count":2}';

function makeLogger() {
  return {
    error: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
    debug: vi.fn(),
  };
}

describe('KafkaLogger', () => {
  // D1 arms, D2 T
  it.each([
    { title: 'D1(ERROR) -> error', level: logLevel.ERROR, method: 'error' },
    { title: 'D1(NOTHING) -> error', level: logLevel.NOTHING, method: 'error' },
    { title: 'D1(WARN) -> warn', level: logLevel.WARN, method: 'warn' },
    { title: 'D1(INFO) -> log', level: logLevel.INFO, method: 'log' },
    { title: 'D1(DEBUG) -> debug', level: logLevel.DEBUG, method: 'debug' },
    {
      title: 'D1(default, level outside the enum) -> debug',
      level: 99 as logLevel,
      method: 'debug',
    },
  ])('$title', ({ level, method }) => {
    const logger = makeLogger();
    const kafkaLogger = KafkaLogger(logger);

    kafkaLogger({ namespace, level, label, log });

    const chosen = (logger as any)[method];
    expect(chosen).toHaveBeenCalledOnce();
    expect(chosen).toHaveBeenCalledWith(expectedMessage);
    for (const other of ['error', 'warn', 'log', 'debug']) {
      if (other !== method) {
        expect((logger as any)[other]).not.toHaveBeenCalled();
      }
    }
  });

  // D2 F - the selected method is missing on the logger object
  it('D2(F) - a logger without the selected method is not called and does not throw', () => {
    const logger = { log: vi.fn() };

    expect(() =>
      KafkaLogger(logger)({ namespace, level: logLevel.ERROR, label, log }),
    ).not.toThrow();
    expect(logger.log).not.toHaveBeenCalled();
  });

  // D2 F - logger is empty
  it('D2(F) - an empty logger object is tolerated', () => {
    expect(() =>
      KafkaLogger({})({ namespace, level: logLevel.DEBUG, label, log }),
    ).not.toThrow();
  });

  it('builds the message from label, namespace and the remaining log fields', () => {
    const logger = makeLogger();
    KafkaLogger(logger)({
      namespace,
      level: logLevel.INFO,
      label,
      log: { message: 'only-message', timestamp: 'now' },
    });

    expect(logger.log).toHaveBeenCalledWith(
      'my-label [my-namespace] only-message {"timestamp":"now"}',
    );
  });
});
