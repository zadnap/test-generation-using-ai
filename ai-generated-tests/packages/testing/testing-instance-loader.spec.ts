import { TestingInstanceLoader } from '../../../packages/testing/testing-instance-loader.js';

describe('TestingInstanceLoader', () => {
  let injector: { setContainer: ReturnType<typeof vi.fn>; setMocker: ReturnType<typeof vi.fn> };
  let container: { getModules: ReturnType<typeof vi.fn> };
  let loader: TestingInstanceLoader;
  let superSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    injector = {
      setContainer: vi.fn(),
      setMocker: vi.fn(),
    };
    container = {
      getModules: vi.fn().mockReturnValue(new Map()),
    };
    loader = new TestingInstanceLoader(
      container as any,
      injector as any,
      {} as any,
    );
    superSpy = vi
      .spyOn(
        Object.getPrototypeOf(TestingInstanceLoader.prototype),
        'createInstancesOfDependencies',
      )
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createInstancesOfDependencies', () => {
    it('uses the modules of the container when none are passed', async () => {
      const modules = new Map([['module', {}]]);
      container.getModules.mockReturnValue(modules);

      await loader.createInstancesOfDependencies();

      expect(container.getModules).toHaveBeenCalledOnce();
      expect(injector.setContainer).toHaveBeenCalledWith(container);
      expect(superSpy).toHaveBeenCalledOnce();
    });

    it('uses explicitly provided modules', async () => {
      const modules = new Map([['explicit', {}]]);

      await loader.createInstancesOfDependencies(modules as any);

      expect(container.getModules).not.toHaveBeenCalled();
      expect(superSpy).toHaveBeenCalledOnce();
    });

    it('does not set a mocker when none is provided', async () => {
      await loader.createInstancesOfDependencies();

      expect(injector.setMocker).not.toHaveBeenCalled();
    });

    it.each([
      ['a factory', () => ({ mocked: true })],
      ['a null mocker', null],
    ])('sets %s when it is truthy', async (_label, mocker) => {
      await loader.createInstancesOfDependencies(undefined, mocker as any);

      if (mocker) {
        expect(injector.setMocker).toHaveBeenCalledWith(mocker);
      } else {
        expect(injector.setMocker).not.toHaveBeenCalled();
      }
    });

    it('waits for the parent loader before resolving', async () => {
      let finished = false;
      superSpy.mockImplementation(async () => {
        finished = true;
      });

      await loader.createInstancesOfDependencies();

      expect(finished).toBe(true);
    });
  });
});
