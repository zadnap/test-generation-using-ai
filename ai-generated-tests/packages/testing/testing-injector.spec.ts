import { TestingInjector } from '../../../packages/testing/testing-injector.js';

describe('TestingInjector', () => {
  let injector: TestingInjector;

  const parentProto = () => Object.getPrototypeOf(TestingInjector.prototype);

  function createCoreModule() {
    return {
      addCustomProvider: vi.fn(),
      addExportedProviderOrModule: vi.fn(),
      providers: new Map(),
    };
  }

  function createContainer(coreModule: any = createCoreModule()) {
    return {
      getInternalCoreModuleRef: vi.fn().mockReturnValue(coreModule),
      coreModule,
    };
  }

  beforeEach(() => {
    injector = new TestingInjector({ preview: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('setMocker', () => {
    it('stores the factory', () => {
      const mocker = vi.fn();

      injector.setMocker(mocker);

      expect(injector['mocker']).toBe(mocker);
    });

    it('forgets mocks created by a previous factory', async () => {
      vi.spyOn(parentProto(), 'resolveComponentWrapper').mockRejectedValue(
        new Error('not found'),
      );
      const container = createContainer();
      injector.setContainer(container as any);

      injector.setMocker(() => ({ from: 'first' }));
      const first = await injector.resolveComponentWrapper(
        {} as any,
        'TOKEN',
        {} as any,
        { metatype: class {} } as any,
      );

      injector.setMocker(() => ({ from: 'second' }));
      const second = await injector.resolveComponentWrapper(
        {} as any,
        'TOKEN',
        {} as any,
        { metatype: class {} } as any,
      );

      expect(first.instance).toEqual({ from: 'first' });
      expect(second.instance).toEqual({ from: 'second' });
    });
  });

  describe('setContainer', () => {
    it('stores the container', () => {
      const container = createContainer();

      injector.setContainer(container as any);

      expect(injector['container']).toBe(container);
    });
  });

  describe('lookupSkippedProviderDependencies', () => {
    it('returns the original lookup when no mocker is set', async () => {
      vi.spyOn(parentProto(), 'lookupSkippedProviderDependencies').mockResolvedValue(
        'resolved',
      );

      await expect(
        (injector as any).lookupSkippedProviderDependencies({}, {}),
      ).resolves.toBe('resolved');
    });

    it('keeps the rejection when no mocker is set', async () => {
      const error = new Error('missing');
      vi.spyOn(parentProto(), 'lookupSkippedProviderDependencies').mockRejectedValue(
        error,
      );

      await expect(
        (injector as any).lookupSkippedProviderDependencies({}, {}),
      ).rejects.toBe(error);
    });

    it('swallows a failed lookup when a mocker is set', async () => {
      vi.spyOn(parentProto(), 'lookupSkippedProviderDependencies').mockRejectedValue(
        new Error('missing'),
      );
      injector.setMocker(() => ({}));

      await expect(
        (injector as any).lookupSkippedProviderDependencies({}, {}),
      ).resolves.toBeUndefined();
    });

    it('returns a successful lookup when a mocker is set', async () => {
      vi.spyOn(parentProto(), 'lookupSkippedProviderDependencies').mockResolvedValue(
        'resolved',
      );
      injector.setMocker(() => ({}));

      await expect(
        (injector as any).lookupSkippedProviderDependencies({}, {}),
      ).resolves.toBe('resolved');
    });
  });

  describe('resolveComponentWrapper', () => {
    it('returns the wrapper resolved by the parent injector', async () => {
      const wrapper = { name: 'Existing' };
      vi.spyOn(parentProto(), 'resolveComponentWrapper').mockResolvedValue(
        wrapper,
      );
      const mocker = vi.fn();
      injector.setMocker(mocker);

      const result = await injector.resolveComponentWrapper(
        {} as any,
        'TOKEN',
        {} as any,
        {} as any,
      );

      expect(result).toBe(wrapper);
      expect(mocker).not.toHaveBeenCalled();
    });

    it('rethrows a resolution failure when no mocker is set', async () => {
      const error = new Error('not found');
      vi.spyOn(parentProto(), 'resolveComponentWrapper').mockRejectedValue(
        error,
      );

      await expect(
        injector.resolveComponentWrapper(
          {} as any,
          'TOKEN',
          {} as any,
          {} as any,
        ),
      ).rejects.toBe(error);
    });

    it('creates and registers a mock when the parent fails', async () => {
      vi.spyOn(parentProto(), 'resolveComponentWrapper').mockRejectedValue(
        new Error('not found'),
      );
      const mocked = { mocked: true };
      const mocker = vi.fn().mockReturnValue(mocked);
      injector.setMocker(mocker);
      const container = createContainer();
      injector.setContainer(container as any);
      const metatype = class Service {};

      const result = await injector.resolveComponentWrapper(
        {} as any,
        'TOKEN',
        {} as any,
        { metatype } as any,
      );

      expect(mocker).toHaveBeenCalledWith('TOKEN');
      expect(result.instance).toBe(mocked);
      expect(result.metatype).toBe(metatype);
      expect(container.coreModule.addCustomProvider).toHaveBeenCalledWith(
        { provide: 'TOKEN', useValue: mocked },
        container.coreModule.providers,
      );
      expect(
        container.coreModule.addExportedProviderOrModule,
      ).toHaveBeenCalledWith('TOKEN');
    });

    it('reuses the mock for the same token', async () => {
      vi.spyOn(parentProto(), 'resolveComponentWrapper').mockRejectedValue(
        new Error('not found'),
      );
      const mocked = { mocked: true };
      const mocker = vi.fn().mockReturnValue(mocked);
      injector.setMocker(mocker);
      injector.setContainer(createContainer() as any);

      const first = await injector.resolveComponentWrapper(
        {} as any,
        'TOKEN',
        {} as any,
        {} as any,
      );
      const second = await injector.resolveComponentWrapper(
        {} as any,
        'TOKEN',
        {} as any,
        {} as any,
      );

      expect(mocker).toHaveBeenCalledOnce();
      expect(first.instance).toBe(second.instance);
    });

    it('keeps mocks for different tokens separate', async () => {
      vi.spyOn(parentProto(), 'resolveComponentWrapper').mockRejectedValue(
        new Error('not found'),
      );
      const mocker = vi.fn(token => ({ token }));
      injector.setMocker(mocker);
      injector.setContainer(createContainer() as any);

      const first = await injector.resolveComponentWrapper(
        {} as any,
        'FIRST',
        {} as any,
        {} as any,
      );
      const second = await injector.resolveComponentWrapper(
        {} as any,
        'SECOND',
        {} as any,
        {} as any,
      );

      expect(mocker).toHaveBeenCalledTimes(2);
      expect(first.instance).not.toBe(second.instance);
    });

    it('rethrows when the mocker returns a falsy value', async () => {
      const error = new Error('not found');
      vi.spyOn(parentProto(), 'resolveComponentWrapper').mockRejectedValue(
        error,
      );
      injector.setMocker(vi.fn().mockReturnValue(undefined));
      injector.setContainer(createContainer() as any);

      await expect(
        injector.resolveComponentWrapper(
          {} as any,
          'TOKEN',
          {} as any,
          {} as any,
        ),
      ).rejects.toBe(error);
    });

    it('reports a missing internal core module', async () => {
      vi.spyOn(parentProto(), 'resolveComponentWrapper').mockRejectedValue(
        new Error('not found'),
      );
      injector.setMocker(vi.fn().mockReturnValue({ mocked: true }));
      injector.setContainer({
        getInternalCoreModuleRef: vi.fn().mockReturnValue(undefined),
      } as any);

      await expect(
        injector.resolveComponentWrapper(
          {} as any,
          'TOKEN',
          {} as any,
          {} as any,
        ),
      ).rejects.toThrow(
        'Expected to have internal core module reference at this point.',
      );
    });
  });

  describe('resolveComponentHost', () => {
    it('returns the host resolved by the parent injector', async () => {
      const wrapper = { name: 'ExistingHost' };
      vi.spyOn(parentProto(), 'resolveComponentHost').mockResolvedValue(wrapper);

      const result = await injector.resolveComponentHost(
        {} as any,
        { name: 'Host' } as any,
      );

      expect(result).toBe(wrapper);
    });

    it('rethrows a host resolution failure when no mocker is set', async () => {
      const error = new Error('host not found');
      vi.spyOn(parentProto(), 'resolveComponentHost').mockRejectedValue(error);

      await expect(
        injector.resolveComponentHost({} as any, { name: 'Host' } as any),
      ).rejects.toBe(error);
    });

    it('creates a mock from the host name when resolution fails', async () => {
      vi.spyOn(parentProto(), 'resolveComponentHost').mockRejectedValue(
        new Error('host not found'),
      );
      const mocked = { host: true };
      const mocker = vi.fn().mockReturnValue(mocked);
      injector.setMocker(mocker);
      const container = createContainer();
      injector.setContainer(container as any);

      const result = await injector.resolveComponentHost(
        {} as any,
        {
          name: 'HostName',
          token: 'HOST_TOKEN',
          metatype: class Host {},
        } as any,
      );

      expect(mocker).toHaveBeenCalledWith('HostName');
      expect(result.instance).toBe(mocked);
      expect(
        container.coreModule.addExportedProviderOrModule,
      ).toHaveBeenCalledWith('HostName');
    });
  });
});
