/**
 * CFT checklist extracted from packages/core/inspector/graph-inspector.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * GraphInspector.constructor @L18 - D=0, P=1.
 * GraphInspector.inspectModules @L22 - D=1, P=2.
 *   1=next iteration of modules.values()
 * GraphInspector.callback @L31 - D=0, P=1.
 * GraphInspector.registerPartial @L38 - D=1, P=2.
 *   1=error instanceof UnknownDependenciesException
 * GraphInspector.inspectInstanceWrapper @L61 - D=0, P=1.
 * GraphInspector.callback @L66 - D=0, P=1.
 * GraphInspector.callback @L77 - D=0, P=1.
 * GraphInspector.insertEnhancerMetadataCache @L82 - D=0, P=1.
 * GraphInspector.insertOrphanedEnhancer @L86 - D=0, P=1.
 * GraphInspector.insertAttachedEnhancer @L93 - D=0, P=1.
 * GraphInspector.insertEntrypointDefinition @L100 - D=0, P=1.
 * GraphInspector.insertClassNode @L111 - D=0, P=1.
 * GraphInspector.insertModuleNode @L136 - D=0, P=1.
 * GraphInspector.insertModuleToModuleEdges @L153 - D=1, P=2.
 *   1=next iteration of moduleRef.imports
 * GraphInspector.insertEnhancerEdge @L167 - D=1, P=2.
 *   1=entry.enhancerInstanceWrapper
 * GraphInspector.insertClassToClassEdge @L205 - D=0, P=1.
 * GraphInspector.insertClassNodes @L229 - D=0, P=1.
 * GraphInspector.callback @L230 - D=0, P=1.
 * GraphInspector.callback @L233 - D=0, P=1.
 * GraphInspector.callback @L236 - D=0, P=1.
 */
import { afterEach, describe, it } from 'vitest';
import { NestContainer } from '../../../../packages/core/injector/container.js';
import { GraphInspector } from '../../../../packages/core/inspector/graph-inspector.js';
import { UnknownDependenciesException } from '../../../../packages/core/errors/exceptions/unknown-dependencies.exception.js';
import { PartialGraphHost } from '../../../../packages/core/inspector/partial-graph.host.js';
import { DeterministicUuidRegistry } from '../../../../packages/core/inspector/deterministic-uuid-registry.js';
afterEach(() => {
  DeterministicUuidRegistry.clear();
  PartialGraphHost.register(undefined as any);
});
describe('GraphInspector', () => {
  describe('module/class/edge/enhancer/entrypoint inspection and partial graph', () => {
    it('provider/controller enhancer refs and class dependencies', async () => {
      const container = new NestContainer();
      class Provider {}
      class Controller {}
      class Enhancer {}
      const first = (await container.addModule(class Root {}, []))!.moduleRef;
      const second = (await container.addModule(
        { module: class Dynamic {}, imports: [] },
        [],
      ))!.moduleRef;
      first.addImport(second);
      first.addProvider(Provider);
      first.addController(Controller);
      first.addInjectable(Enhancer, 'guard');
      const source = first.getProviderByKey(Provider);
      const target = first.injectables.get(Enhancer)!;
      source.addCtorMetadata(0, target);
      source.addPropertiesMetadata('property', target);
      const inspector = new GraphInspector(container);
      inspector.inspectInstanceWrapper(source, first);
      inspector.inspectInstanceWrapper(target, first);
      for (const classRef of [Provider, Controller])
        for (const enhancer of [
          { enhancerInstanceWrapper: target },
          { enhancerRef: {} },
          {
            enhancerRef: Object.assign(() => undefined, { constructor: null }),
          },
        ])
          inspector.insertEnhancerMetadataCache({
            moduleToken: first.token,
            classRef,
            methodKey: 'handle',
            subtype: 'guard',
            ...enhancer,
          } as any);
      inspector.inspectModules();
      inspector.insertAttachedEnhancer(source);
      inspector.insertOrphanedEnhancer({ subtype: 'guard', ref: null } as any);
      inspector.insertOrphanedEnhancer({ subtype: 'guard', ref: {} } as any);
      inspector.insertEntrypointDefinition(
        { classNodeId: source.id, methodName: 'handle' } as any,
        first.id,
      );
      inspector.registerPartial(new Error('fixture'));
      inspector.registerPartial(
        new UnknownDependenciesException(
          'Fixture',
          { index: 0, dependencies: [] },
          first,
          { id: 'node' },
        ),
      );
      inspector.registerPartial(
        new UnknownDependenciesException('Fixture', {
          index: 0,
          dependencies: [],
        }),
      );
    });
  });
});
