import { RpcException } from '../../../../packages/microservices/exceptions/rpc-exception.js';

/**
 * CFG / C3:
 * D1: isString(this.error)                              -> c1
 * D2: isObject(this.error) && isString(this.error.message) -> c2, c3
 * D3: this.constructor                                  -> c4
 * Infeasible: c4 is falsy for every instance created with `new` (the
 * prototype chain always provides `constructor`); it is exercised below with
 * an object that shadows `constructor`, which is the only way to reach it.
 */
describe('RpcException (constructor)', () => {
  it('is an Error and stores the payload', () => {
    const exception = new RpcException('Unauthorized');

    expect(exception).toBeInstanceOf(Error);
    expect(exception.getError()).toBe('Unauthorized');
  });

  it('initializes the message from a string payload', () => {
    expect(new RpcException('Unauthorized').message).toBe('Unauthorized');
  });

  it('initializes the message from an object payload', () => {
    expect(new RpcException({ message: 'custom', code: 1 }).message).toBe(
      'custom',
    );
  });

  it('keeps an empty string message as the empty string', () => {
    // '' is a string, so D1 takes the true branch even though it is falsy.
    const exception = new RpcException('');

    expect(exception.message).toBe('');
    expect(exception.getError()).toBe('');
  });
});

describe('RpcException.initMessage', () => {
  it('D1(T) - string error becomes the message', () => {
    const exception = new RpcException({} as any);
    exception['error'] = 'from string';

    exception.initMessage();

    expect(exception.message).toBe('from string');
  });

  it('D1(F) D2(T,T) - object with a string message', () => {
    const exception = new RpcException({} as any);
    exception['error'] = { message: 'from object', code: 7 };

    exception.initMessage();

    expect(exception.message).toBe('from object');
  });

  it('D1(F) D2(T,F) D3(T) - object with a non-string message uses the class name', () => {
    const exception = new RpcException({} as any);
    exception['error'] = { message: 42 };

    exception.initMessage();

    expect(exception.message).toBe('Rpc Exception');
  });

  it('D1(F) D2(F) D3(T) - number primitive uses the class name', () => {
    const exception = new RpcException({} as any);
    exception['error'] = 42 as any;

    exception.initMessage();

    expect(exception.message).toBe('Rpc Exception');
  });

  it('D1(F) D2(F) D3(T) - subclass name is split into words', () => {
    class NotFoundException extends RpcException {}
    const exception = new NotFoundException({ code: 1 });

    expect(exception.message).toBe('Not Found Exception');
  });

  it('D1(F) D2(F) D3(T) - digits in a class name are kept as words', () => {
    class Http2Exception extends RpcException {}
    const exception = new Http2Exception({});

    expect(exception.message).toBe('Http 2 Exception');
  });

  it('D1(F) D2(F) D3(T) - anonymous class falls back to Error', () => {
    const AnonymousFactory = () => class extends RpcException {};
    const exception = new (AnonymousFactory())({});

    expect(exception.constructor.name).toBe('');
    expect(exception.message).toBe('Error');
  });

  it('D1(F) D2(F) D3(F) - a shadowed constructor leaves the message untouched', () => {
    const context = Object.create(RpcException.prototype) as any;
    Object.defineProperty(context, 'constructor', {
      value: undefined,
      configurable: true,
    });
    context.error = 42;

    RpcException.prototype.initMessage.call(context);

    // Nothing was assigned: the value still comes from Error.prototype.
    expect(Object.prototype.hasOwnProperty.call(context, 'message')).toBe(
      false,
    );
    expect(context.message).toBe(Error.prototype.message);
  });

  it('is idempotent across repeated calls', () => {
    const exception = new RpcException({ message: 'stable' });
    exception.initMessage();

    expect(exception.message).toBe('stable');
  });
});

/** CFG / C3 of getError: single return, no decisions. */
describe('RpcException.getError', () => {
  it('returns the string payload unchanged', () => {
    expect(new RpcException('payload').getError()).toBe('payload');
  });

  it('returns the object payload by reference', () => {
    const payload = { message: 'payload', code: 3 };

    expect(new RpcException(payload).getError()).toBe(payload);
  });

  it('returns an array payload by reference', () => {
    const payload = ['a', 'b'];

    expect(new RpcException(payload).getError()).toBe(payload);
  });
});
