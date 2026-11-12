import {
  CLIENT_CONFIGURATION_METADATA,
  CLIENT_METADATA,
} from '../../../../packages/microservices/constants.js';
import { Client } from '../../../../packages/microservices/decorators/client.decorator.js';

const clientOptions = { transport: 0, options: { host: 'localhost' } };

/**
 * CFG / C3 of Client: the factory has no decisions; the returned property
 * decorator always performs the same three writes (property, is-client flag,
 * configuration). Both the "metadata provided" and "metadata omitted" inputs
 * are exercised.
 */
describe('Client', () => {
  class TestController {
    @Client(clientOptions as any)
    public tcpClient: any;

    @Client()
    public plainClient: any;
  }

  it('writes null to the decorated property', () => {
    expect(Reflect.get(TestController.prototype, 'tcpClient')).toBeNull();
    expect(Reflect.get(TestController.prototype, 'plainClient')).toBeNull();
  });

  it('marks the property as a client instance', () => {
    expect(
      Reflect.getOwnMetadata(
        CLIENT_METADATA,
        TestController.prototype,
        'tcpClient',
      ),
    ).toBe(true);
    expect(
      Reflect.getOwnMetadata(
        CLIENT_METADATA,
        TestController.prototype,
        'plainClient',
      ),
    ).toBe(true);
  });

  it('stores the provided configuration', () => {
    expect(
      Reflect.getOwnMetadata(
        CLIENT_CONFIGURATION_METADATA,
        TestController.prototype,
        'tcpClient',
      ),
    ).toBe(clientOptions);
  });

  it('stores undefined when the configuration is omitted', () => {
    expect(
      Reflect.getOwnMetadata(
        CLIENT_CONFIGURATION_METADATA,
        TestController.prototype,
        'plainClient',
      ),
    ).toBeUndefined();
  });

  it('keeps the decorated properties independent', () => {
    const instance = new TestController();

    expect(instance.tcpClient).toBeNull();
    expect(instance.plainClient).toBeNull();
    expect(
      Reflect.getMetadata(CLIENT_CONFIGURATION_METADATA, instance, 'tcpClient'),
    ).toBe(clientOptions);
  });

  it('works on a plain object target and symbol keys', () => {
    const target: any = {};
    const key = Symbol('client');

    Client(clientOptions as any)(target, key);

    expect(Reflect.get(target, key)).toBeNull();
    expect(Reflect.getOwnMetadata(CLIENT_METADATA, target, key)).toBe(true);
    expect(
      Reflect.getOwnMetadata(CLIENT_CONFIGURATION_METADATA, target, key),
    ).toBe(clientOptions);
  });

  it('returns a decorator function', () => {
    expect(Client()).toBeTypeOf('function');
    expect(Client(clientOptions as any)).toBeTypeOf('function');
  });
});
