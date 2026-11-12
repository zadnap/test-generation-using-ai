import { describe, expect, it } from 'vitest';
import { InvalidTcpDataReceptionException } from '../../../../packages/microservices/errors/invalid-tcp-data-reception.exception.js';

/**
 * CFG / C3 decisions of the constructor:
 * D1: typeof err === 'string'                                    -> 1c1
 * D2: err && typeof err === 'object' && 'message' in err
 *     && typeof err.message === 'string'                         -> 2c1..2c4
 * D3: errMsgStr.includes('Corrupted length value')               -> 3c1
 * Independent paths (C3) = 6 + 1 = 7.
 */
describe('InvalidTcpDataReceptionException', () => {
  describe('D1 - string input', () => {
    it('1c1(T) 3c1(T) - string mentioning a corrupted length value', () => {
      const error = new InvalidTcpDataReceptionException(
        'Corrupted length value #12abc',
      );
      expect(error.message).toContain('Corrupted length value of the received');
    });

    it('1c1(T) 3c1(F) - arbitrary string is short-circuited past D2', () => {
      const error = new InvalidTcpDataReceptionException('boom');
      expect(error.message).toBe(
        'The invalid received message from tcp server',
      );
    });
  });

  describe('D2 - non-string error-like input', () => {
    it('1c1(F) 2c1(T) 2c2(T) 2c3(T) 2c4(T) 3c1(T) - Error with matching message', () => {
      const error = new InvalidTcpDataReceptionException(
        new Error('Corrupted length value'),
      );
      expect(error.message).toContain('Corrupted length value of the received');
    });

    it('1c1(F) 2c1(T) 2c2(T) 2c3(T) 2c4(T) 3c1(F) - plain object with string message', () => {
      const error = new InvalidTcpDataReceptionException({ message: 'nope' });
      expect(error.message).toBe(
        'The invalid received message from tcp server',
      );
    });

    it('2c1(T) 2c2(T) 2c3(T) 2c4(F) - message property is not a string', () => {
      const error = new InvalidTcpDataReceptionException({
        message: 42,
      } as any);
      expect(error.message).toBe(
        'The invalid received message from tcp server',
      );
    });

    it('2c1(T) 2c2(T) 2c3(F) - function input fails the object check', () => {
      const error = new InvalidTcpDataReceptionException((() => {}) as any);
      expect(error.message).toBe(
        'The invalid received message from tcp server',
      );
    });

    it('2c1(F) - null short-circuits the object checks', () => {
      const error = new InvalidTcpDataReceptionException(null as any);
      expect(error.message).toBe(
        'The invalid received message from tcp server',
      );
    });

    it('2c3(T) 2c4(F) - object without a message property', () => {
      const error = new InvalidTcpDataReceptionException({} as any);
      expect(error.message).toBe(
        'The invalid received message from tcp server',
      );
    });

    it('2c2(T) 2c3(F) - array is an object without a message property', () => {
      const error = new InvalidTcpDataReceptionException([] as any);
      expect(error.message).toBe(
        'The invalid received message from tcp server',
      );
    });
  });
});
