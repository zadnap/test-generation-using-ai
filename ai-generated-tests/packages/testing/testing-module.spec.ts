import { Logger, Module as ModuleDecorator } from '@nestjs/common';
import { NestApplicationContext } from '@nestjs/core';
import { ApplicationConfig } from '@nestjs/core/application-config';
import { NestContainer } from '@nestjs/core/injector/container';
import { Module } from '@nestjs/core/injector/module';
import { NoopGraphInspector } from '@nestjs/core/inspector/noop-graph-inspector';
import { tryLoadPackage } from '@nestjs/common/internal';
import { Test } from '../../../packages/testing/test.js';
import { TestingModule } from '../../../packages/testing/testing-module.js';

class MockNestMicroservice {
  static last: MockNestMicroservice | undefined;

  constructor(
    public container: any,
    public options: any,
    public graphInspector: any,
    public applicationConfig: any,
  ) {
    MockNestMicroservice.last = this;
  }
}

function createMockAdapter(extra: Record<string, any> = {}) {
  return {
    patch: vi.fn(),
    initHttpServer: vi.fn(),
    getHttpServer: vi.fn().mockReturnValue({}),
    ...extra,
  };
}

const compileEmptyModule = () => Test.createTestingModule({}).compile();

describe('TestingModule', () => {
  beforeAll(async () => {
    await tryLoadPackage('@nestjs/microservices', () => ({
      NestMicroservice: MockNestMicroservice,
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    MockNestMicroservice.last = undefined;
  });

  describe('constructor', () => {
    it('extends NestApplicationContext', () => {
      const container = new NestContainer();
      const root = new Module(class RootModule {}, container);

      const testingModule = new TestingModule(
        container,
        NoopGraphInspector,
        root,
        new ApplicationConfig(),
      );

      expect(testingModule).toBeInstanceOf(NestApplicationContext);
      expect(testingModule['graphInspector']).toBe(NoopGraphInspector);
    });
  });

  describe('preloadLazyPackages', () => {
    it('loads the optional platform packages', async () => {
      const testingModule = await compileEmptyModule();

      await expect(
        (testingModule as any).preloadLazyPackages(),
      ).resolves.toBeUndefined();
    });
  });

  describe('isHttpServer', () => {
    it.each([
      ['undefined', undefined, false],
      ['an options object', {}, false],
      ['an object without patch', { getHttpServer: vi.fn() }, false],
      ['an adapter', { patch: vi.fn() }, true],
    ])('recognizes %s', async (_label, value, expected) => {
      const testingModule = await compileEmptyModule();

      expect((testingModule as any).isHttpServer(value)).toBe(expected);
    });
  });

  describe('createNestApplication', () => {
    it('uses a provided adapter', async () => {
      const testingModule = await compileEmptyModule();
      const adapter = createMockAdapter({ marker: 'adapter' });

      const app: any = testingModule.createNestApplication(adapter as any);

      expect(app.httpAdapter).toBe(adapter);
      expect(app.marker).toBe('adapter');
    });

    it('creates an http adapter from application options', async () => {
      const testingModule = await compileEmptyModule();
      const overrideSpy = vi.spyOn(Logger, 'overrideLogger');

      const app: any = testingModule.createNestApplication({ logger: false });

      expect(app.httpAdapter).toBeDefined();
      expect(overrideSpy).toHaveBeenCalledWith(false);
    });

    it('creates an http adapter when no argument is given', async () => {
      const testingModule = await compileEmptyModule();
      const overrideSpy = vi.spyOn(Logger, 'overrideLogger');

      const app: any = testingModule.createNestApplication();

      expect(app.httpAdapter).toBeDefined();
      expect(overrideSpy).not.toHaveBeenCalled();
    });
  });

  describe('createNestMicroservice', () => {
    it('creates a microservice with the supplied options', async () => {
      const testingModule = await compileEmptyModule();
      const options = { transport: 0, logger: false };

      const microservice = testingModule.createNestMicroservice(options as any);

      expect(microservice).toBeInstanceOf(MockNestMicroservice);
      expect((microservice as any).options).toBe(options);
      expect((microservice as any).container).toBe(testingModule['container']);
    });
  });

  describe('createHttpAdapter', () => {
    it('creates an ExpressAdapter without a server', async () => {
      const testingModule = await compileEmptyModule();

      const adapter: any = (testingModule as any).createHttpAdapter();

      expect(adapter).toBeDefined();
      expect(adapter.getHttpServer).toBeTypeOf('function');
    });

    it('passes an existing server to the adapter', async () => {
      const testingModule = await compileEmptyModule();
      const server = { use: vi.fn() };

      const adapter: any = (testingModule as any).createHttpAdapter(server);

      expect(adapter.getInstance()).toBe(server);
    });
  });

  describe('applyLogger', () => {
    it.each([
      ['undefined options', undefined, false],
      ['empty options', {}, false],
      ['an undefined logger', { logger: undefined }, false],
      ['a disabled logger', { logger: false }, true],
      ['a logger level list', { logger: ['warn'] }, true],
    ])('handles %s', async (_label, options, shouldOverride) => {
      const testingModule = await compileEmptyModule();
      const overrideSpy = vi.spyOn(Logger, 'overrideLogger');

      (testingModule as any).applyLogger(options);

      if (shouldOverride) {
        expect(overrideSpy).toHaveBeenCalledWith((options as any).logger);
      } else {
        expect(overrideSpy).not.toHaveBeenCalled();
      }
    });
  });

  describe('createAdapterProxy', () => {
    it('returns a non-function adapter property', async () => {
      const testingModule = await compileEmptyModule();
      const adapter = createMockAdapter({ state: 'ready' });

      const app: any = testingModule.createNestApplication(adapter as any);

      expect(app.state).toBe('ready');
    });

    it('calls an adapter method with the adapter as receiver', async () => {
      const testingModule = await compileEmptyModule();
      const adapter = createMockAdapter({
        compute(this: any, left: number, right: number) {
          this.lastComputation = left + right;
          return this.lastComputation;
        },
      });

      const app: any = testingModule.createNestApplication(adapter as any);
      const result = app.compute(2, 3);

      expect(result).toBe(5);
      expect(adapter.lastComputation).toBe(5);
      expect(Object.hasOwn(app, 'lastComputation')).toBe(false);
    });

    it('keeps chainable adapter methods returning the application', async () => {
      const testingModule = await compileEmptyModule();
      const adapter = createMockAdapter({
        chainable() {
          return this;
        },
      });

      const app: any = testingModule.createNestApplication(adapter as any);

      expect(app.chainable()).toBe(app);
    });

    it('reads properties that exist on the application itself', async () => {
      const testingModule = await compileEmptyModule();
      const adapter = createMockAdapter();

      const app: any = testingModule.createNestApplication(adapter as any);

      expect(app.getHttpAdapter()).toBe(adapter);
    });

    it('returns undefined when neither object has the property', async () => {
      const testingModule = await compileEmptyModule();
      const adapter = createMockAdapter();

      const app: any = testingModule.createNestApplication(adapter as any);

      expect(app.missingProperty).toBeUndefined();
    });
  });
});
