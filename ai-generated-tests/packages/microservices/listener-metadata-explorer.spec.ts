import { MetadataScanner } from '../../../packages/core/metadata-scanner.js';
import {
  CLIENT_CONFIGURATION_METADATA,
  CLIENT_METADATA,
} from '../../../packages/microservices/constants.js';
import { Client } from '../../../packages/microservices/decorators/client.decorator.js';
import { EventPattern } from '../../../packages/microservices/decorators/event-pattern.decorator.js';
import { MessagePattern } from '../../../packages/microservices/decorators/message-pattern.decorator.js';
import { Transport } from '../../../packages/microservices/enums/transport.enum.js';
import { ListenerMetadataExplorer } from '../../../packages/microservices/listener-metadata-explorer.js';

const clientMetadata = { transport: Transport.TCP } as any;
const messagePattern = { cmd: 'message' };
const eventPattern = { event: 'event' };
const firstPattern = { cmd: 'first' };
const secondPattern = { cmd: 'second' };
const extras = { qos: 1 };

class TestController {
  @Client(clientMetadata)
  public client: any;

  @Client()
  public plainClient: any;

  @MessagePattern(messagePattern)
  public message() {}

  @EventPattern(eventPattern, Transport.REDIS)
  public event() {}

  @MessagePattern([firstPattern, secondPattern])
  public multiple() {}

  @MessagePattern(messagePattern, Transport.KAFKA, extras)
  public withExtras() {}

  public noPattern() {}
}

describe('ListenerMetadataExplorer', () => {
  let scanner: MetadataScanner;
  let explorer: ListenerMetadataExplorer;

  beforeEach(() => {
    scanner = new MetadataScanner();
    explorer = new ListenerMetadataExplorer(scanner);
  });

  /**
   * CFG / C3 of explore:
   * D1: .filter(metadata => metadata) truthiness - undefined results produced by
   *     methods without handler metadata are dropped (false) or kept (true).
   * Infeasible: none.
   */
  describe('explore', () => {
    it('returns only the methods that carry handler metadata', () => {
      const definitions = explorer.explore(new TestController());

      expect(
        definitions.map(definition => definition.methodKey).sort(),
      ).toEqual(['event', 'message', 'multiple', 'withExtras']);
    });

    it('D1(F) - drops the undefined result of a method without handler metadata', () => {
      class PlainController {
        public noPattern() {}
        public other() {}
      }

      expect(explorer.explore(new PlainController())).toEqual([]);
    });

    it('scans the prototype of the instance', () => {
      const controller = new TestController();
      const getAllMethodNames = vi.spyOn(scanner, 'getAllMethodNames');

      explorer.explore(controller);

      expect(getAllMethodNames).toHaveBeenCalledExactlyOnceWith(
        Object.getPrototypeOf(controller),
      );
    });

    it('keeps the target callback bound to the explored instance', () => {
      const controller = new TestController();
      const definition = explorer
        .explore(controller)
        .find(({ methodKey }) => methodKey === 'message')!;

      expect(definition.targetCallback).toBe(controller.message);
    });

    it('returns one definition per decorated method, not per pattern', () => {
      const definition = explorer
        .explore(new TestController())
        .find(({ methodKey }) => methodKey === 'multiple')!;

      expect(definition.patterns).toEqual([firstPattern, secondPattern]);
    });
  });

  /**
   * CFG / C3 of exploreMethodMetadata:
   * D1: isUndefined(handlerType)              -> c1
   * D2: handlerType === PatternHandler.EVENT  -> both outcomes (EVENT/MESSAGE)
   * Infeasible: a method carrying PATTERN_HANDLER_METADATA but no patterns is
   * not produced by the decorators; D1 only distinguishes presence.
   */
  describe('exploreMethodMetadata', () => {
    let controller: TestController;

    beforeEach(() => {
      controller = new TestController();
    });

    it('D1(T) - returns undefined when handler metadata is missing', () => {
      expect(
        explorer.exploreMethodMetadata(
          controller,
          Object.getPrototypeOf(controller),
          'noPattern',
        ),
      ).toBeUndefined();
    });

    it('D1(F) D2(F) - message handler metadata', () => {
      const definition = explorer.exploreMethodMetadata(
        controller,
        Object.getPrototypeOf(controller),
        'message',
      )!;

      expect(definition).toEqual({
        methodKey: 'message',
        targetCallback: controller.message,
        patterns: [messagePattern],
        transport: undefined,
        extras: {},
        isEventHandler: false,
      });
    });

    it('D1(F) D2(T) - event handler metadata keeps the transport', () => {
      const definition = explorer.exploreMethodMetadata(
        controller,
        Object.getPrototypeOf(controller),
        'event',
      )!;

      expect(definition.isEventHandler).toBe(true);
      expect(definition.patterns).toEqual([eventPattern]);
      expect(definition.transport).toBe(Transport.REDIS);
      expect(definition.extras).toEqual({});
    });

    it('D1(F) D2(F) - keeps the extras declared on the handler', () => {
      const definition = explorer.exploreMethodMetadata(
        controller,
        Object.getPrototypeOf(controller),
        'withExtras',
      )!;

      expect(definition.extras).toEqual(extras);
      expect(definition.transport).toBe(Transport.KAFKA);
    });

    it('D1(F) - returns every pattern of a multi-pattern handler', () => {
      const definition = explorer.exploreMethodMetadata(
        controller,
        Object.getPrototypeOf(controller),
        'multiple',
      )!;

      expect(definition.patterns).toEqual([firstPattern, secondPattern]);
    });
  });

  /**
   * CFG / C3 of scanForClientHooks:
   * D1: isFunction(instance[propertyKey])          -> c1 (skip function members)
   * D2: isUndefined(Reflect.getMetadata(CLIENT_METADATA, ...)) -> c2
   * Infeasible: none; both decisions are exercised true and false.
   */
  describe('scanForClientHooks', () => {
    it('yields client properties and skips functions and plain properties', () => {
      const controller = new TestController();
      (controller as any).fnHook = () => null;
      Reflect.defineMetadata(CLIENT_METADATA, true, controller, 'fnHook');
      Reflect.defineMetadata(
        CLIENT_CONFIGURATION_METADATA,
        clientMetadata,
        controller,
        'fnHook',
      );
      (controller as any).notAClient = 'plain';

      const hooks = [...explorer.scanForClientHooks(controller)];

      expect(hooks).toEqual([
        { property: 'client', metadata: clientMetadata },
        { property: 'plainClient', metadata: undefined },
      ]);
    });

    it('D1(F) D2(T) - yields nothing when no property carries client metadata', () => {
      const isolated: any = { notAClient: 'plain' };

      expect([...explorer.scanForClientHooks(isolated)]).toEqual([]);
    });

    it('D1(T) - skips a function member even when it carries client metadata', () => {
      class FunctionMemberController {
        @Client(clientMetadata)
        public client: any;
      }
      const controller = new FunctionMemberController();
      (controller as any).fnHook = function fnHook() {};
      Reflect.defineMetadata(CLIENT_METADATA, true, controller, 'fnHook');
      Reflect.defineMetadata(
        CLIENT_CONFIGURATION_METADATA,
        clientMetadata,
        controller,
        'fnHook',
      );

      const properties = [...explorer.scanForClientHooks(controller)].map(
        hook => hook.property,
      );

      expect(properties).toEqual(['client']);
    });

    it('D1(F) D2(F) - yields the configuration of a decorated property', () => {
      const controller = new TestController();

      const hook = [...explorer.scanForClientHooks(controller)].find(
        ({ property }) => property === 'client',
      );

      expect(hook).toEqual({ property: 'client', metadata: clientMetadata });
    });

    it('returns an empty iterator for an empty instance', () => {
      expect([...explorer.scanForClientHooks({} as any)]).toEqual([]);
    });
  });
});
