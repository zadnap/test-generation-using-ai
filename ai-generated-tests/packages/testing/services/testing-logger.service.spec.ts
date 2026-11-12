import { ConsoleLogger } from '@nestjs/common';
import { TestingLogger } from '../../../../packages/testing/services/testing-logger.service.js';

describe('TestingLogger', () => {
  let logger: TestingLogger;

  beforeEach(() => {
    logger = new TestingLogger();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('silent levels', () => {
    it.each(['log', 'warn', 'debug', 'verbose'] as const)(
      '%s does not write through the console logger',
      method => {
        const spy = vi
          .spyOn(ConsoleLogger.prototype, method)
          .mockImplementation(() => undefined);

        logger[method]('message');

        expect(spy).not.toHaveBeenCalled();
      },
    );
  });

  describe('error', () => {
    it('delegates the message to ConsoleLogger.error', () => {
      const spy = vi
        .spyOn(ConsoleLogger.prototype, 'error')
        .mockImplementation(() => undefined);

      logger.error('something went wrong');

      expect(spy).toHaveBeenCalledWith('something went wrong');
    });

    it.each([
      [['error message', 'stack trace']],
      [['error message', 'stack trace', 'Context']],
      [['error message', { code: 1 }, 'stack trace', 'Context']],
    ])('forwards optional parameters %j', optionalParams => {
      const spy = vi
        .spyOn(ConsoleLogger.prototype, 'error')
        .mockImplementation(() => undefined);

      logger.error('error message', ...optionalParams);

      expect(spy).toHaveBeenCalledWith('error message', ...optionalParams);
    });
  });
});
