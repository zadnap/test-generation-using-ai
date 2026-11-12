import { Logger } from '@nestjs/common';
import { GraphInspector } from '@nestjs/core/inspector/graph-inspector.js';
import { NoopGraphInspector } from '@nestjs/core/inspector/noop-graph-inspector.js';
import {
  UuidFactory,
  UuidFactoryMode,
} from '@nestjs/core/inspector/uuid-factory.js';
import { Test } from '../../../packages/testing/test.js';
import { TestingLogger } from '../../../packages/testing/services/testing-logger.service.js';
import { TestingModule } from '../../../packages/testing/testing-module.js';
import { TestingModuleBuilder } from '../../../packages/testing/testing-module.builder.js';

const createBuilder = () => Test.createTestingModule({});

const overrideCases: Array<[string, string, boolean]> = [
  ['overridePipe', 'injectableOverloadsMap', false],
  ['overrideFilter', 'injectableOverloadsMap', false],
  ['overrideGuard', 'injectableOverloadsMap', false],
  ['overrideInterceptor', 'injectableOverloadsMap', false],
  ['overrideProvider', 'providerOverloadsMap', true],
];

describe('TestingModuleBuilder', () => {
  afterEach(() => {
    UuidFactory.mode = UuidFactoryMode.Random;
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('creates a container and a root module', () => {
      const builder = createBuilder();

      expect(builder).toBeInstanceOf(TestingModuleBuilder);
      expect(builder['container']).toBeDefined();
      expect(builder['module']).toBeTypeOf('function');
    });
  });

  describe.each(overrideCases)('%s', (method, mapName, isProvider) => {
    it('registers a useValue override', () => {
      const builder = createBuilder();
      const value = { value: true };

      const result = (builder as any)[method]('TOKEN').useValue(value);

      expect(result).toBe(builder);
      expect((builder as any)[mapName].get('TOKEN')).toEqual({
        useValue: value,
        isProvider,
      });
    });

    it('registers a useFactory override', () => {
      const builder = createBuilder();
      const factory = () => 'created';
      const inject = ['DEPENDENCY'];

      const result = (builder as any)[method]('TOKEN').useFactory({
        factory,
        inject,
      });

      expect(result).toBe(builder);
      expect((builder as any)[mapName].get('TOKEN')).toEqual({
        factory,
        inject,
        useFactory: factory,
        isProvider,
      });
    });

    it('registers a useClass override', () => {
      const builder = createBuilder();
      class Replacement {}

      const result = (builder as any)[method]('TOKEN').useClass(Replacement);

      expect(result).toBe(builder);
      expect((builder as any)[mapName].get('TOKEN')).toEqual({
        useClass: Replacement,
        isProvider,
      });
    });
  });

  describe('overrideModule', () => {
    it('stores the replacement module and stays chainable', () => {
      const builder = createBuilder();
      const moduleToReplace = { type: class OldModule {} } as any;
      const newModule = { type: class NewModule {} } as any;

      const result = builder
        .overrideModule(moduleToReplace)
        .useModule(newModule);

      expect(result).toBe(builder);
      expect(builder['moduleOverloadsMap'].get(moduleToReplace)).toBe(
        newModule,
      );
    });
  });

  describe('setLogger', () => {
    it('stores the logger and stays chainable', () => {
      const builder = createBuilder();
      const logger = new TestingLogger();

      const result = builder.setLogger(logger);

      expect(result).toBe(builder);
      expect(builder['testingLogger']).toBe(logger);
    });
  });

  describe('useMocker', () => {
    it('stores the mocker and stays chainable', () => {
      const builder = createBuilder();
      const mocker = vi.fn();

      const result = builder.useMocker(mocker);

      expect(result).toBe(builder);
      expect(builder['mocker']).toBe(mocker);
    });
  });

  describe('getModuleOverloads', () => {
    it('returns an empty list without module overrides', () => {
      const builder = createBuilder();

      expect(builder['getModuleOverloads']()).toEqual([]);
    });

    it('maps stored overrides to the scanner shape', () => {
      const builder = createBuilder();
      const moduleToReplace = { type: class OldModule {} } as any;
      const newModule = { type: class NewModule {} } as any;
      builder.overrideModule(moduleToReplace).useModule(newModule);

      expect(builder['getModuleOverloads']()).toEqual([
        { moduleToReplace, newModule },
      ]);
    });
  });

  describe('getRootModule', () => {
    it('returns the first module of the container', () => {
      const builder = createBuilder();
      const first = builder['container'].getModules().values().next().value;

      expect(builder['getRootModule']()).toBe(first);
    });
  });

  describe('applyOverloadsMap', () => {
    it('applies provider and injectable overrides in order', () => {
      const builder = createBuilder();
      builder.overrideProvider('PROVIDER').useValue('provider-value');
      builder.overrideGuard('GUARD').useValue('guard-value');
      const replaceSpy = vi
        .spyOn(builder['container'], 'replace')
        .mockImplementation(() => undefined);

      builder['applyOverloadsMap']();

      expect(replaceSpy).toHaveBeenNthCalledWith(1, 'PROVIDER', {
        useValue: 'provider-value',
        isProvider: true,
      });
      expect(replaceSpy).toHaveBeenNthCalledWith(2, 'GUARD', {
        useValue: 'guard-value',
        isProvider: false,
      });
      expect(replaceSpy).toHaveBeenCalledTimes(2);
    });

    it('does nothing when there is no override', () => {
      const builder = createBuilder();
      const replaceSpy = vi.spyOn(builder['container'], 'replace');

      builder['applyOverloadsMap']();

      expect(replaceSpy).not.toHaveBeenCalled();
    });
  });

  describe('compile', () => {
    it('compiles a testing module with the default options', async () => {
      const testingModule = await createBuilder().compile();

      expect(testingModule).toBeInstanceOf(TestingModule);
      expect(testingModule['graphInspector']).toBe(NoopGraphInspector);
    });

    it('uses deterministic graph output in snapshot mode', async () => {
      const testingModule = await createBuilder().compile({ snapshot: true });

      expect(testingModule).toBeInstanceOf(TestingModule);
      expect(testingModule['graphInspector']).toBeInstanceOf(GraphInspector);
    });

    it('compiles with preview enabled', async () => {
      const testingModule = await createBuilder().compile({ preview: true });

      expect(testingModule).toBeInstanceOf(TestingModule);
    });

    it('uses the configured testing logger', async () => {
      const builder = createBuilder();
      const logger = new TestingLogger();
      const overrideSpy = vi.spyOn(Logger, 'overrideLogger');
      builder.setLogger(logger);

      await builder.compile();

      expect(overrideSpy).toHaveBeenCalledWith(logger);
    });

    it('installs a TestingLogger when none is configured', async () => {
      const overrideSpy = vi.spyOn(Logger, 'overrideLogger');

      await createBuilder().compile();

      expect(overrideSpy).toHaveBeenCalledWith(expect.any(TestingLogger));
    });

    it('applies overrides before creating instances', async () => {
      const builder = Test.createTestingModule({
        providers: [{ provide: 'TOKEN', useValue: 'original' }],
      });
      builder.overrideProvider('TOKEN').useValue('overridden');

      const testingModule = await builder.compile();

      expect(testingModule.get('TOKEN')).toBe('overridden');
    });
  });
});
