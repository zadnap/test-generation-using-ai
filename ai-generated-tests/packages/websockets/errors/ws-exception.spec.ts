import { RuntimeException } from '../../../../packages/core/internal.js';
import { describe, expect, it } from 'vitest';
import { InvalidSocketPortException } from '../../../../packages/websockets/errors/invalid-socket-port.exception.js';
import { WsException } from '../../../../packages/websockets/errors/ws-exception.js';

describe('WsException', () => {
  it('should use a string error as the message', () => {
    const exception = new WsException('forbidden');

    expect(exception.message).toBe('forbidden');
    expect(exception.getError()).toBe('forbidden');
  });

  it('should use the message of an object error', () => {
    const error = { message: 'not found', status: 404 };
    const exception = new WsException(error);

    expect(exception.message).toBe('not found');
    expect(exception.getError()).toBe(error);
  });

  it('should derive the message from the class name for other values', () => {
    const exception = new WsException(42 as any);

    expect(exception.message).toBe('Ws Exception');
    expect(exception.getError()).toBe(42);
  });

  it('should derive the message for an object without a string message', () => {
    const error = { message: 123 };
    const exception = new WsException(error);

    expect(exception.message).toBe('Ws Exception');
  });

  it('should fall back to "Error" when the class name has no words', () => {
    class _ extends WsException {}
    const exception = new _(42 as any);

    expect(exception.message).toBe('Error');
  });

  it('should keep an empty string error', () => {
    const exception = new WsException('');

    expect(exception.message).toBe('');
  });
});

describe('InvalidSocketPortException', () => {
  it('should describe the invalid port and the gateway type', () => {
    const exception = new InvalidSocketPortException('abc', 'TestGateway');

    expect(exception.message).toBe('Invalid port (abc) in gateway TestGateway');
    expect(exception).toBeInstanceOf(RuntimeException);
  });
});
