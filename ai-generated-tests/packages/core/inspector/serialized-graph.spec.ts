/**
 * CFT checklist extracted from packages/core/inspector/serialized-graph.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * SerializedGraph.status @L52 - D=0, P=1.
 * SerializedGraph.metadata @L56 - D=0, P=1.
 * SerializedGraph.insertNode @L60 - D=3, P=4.
 *   1c1=nodeDefinition.metadata.type === 'provider' | 1c2=SerializedGraph.INTERNAL_PROVIDERS.includes(nodeDefinition.metadata.token)
 *   2=this.nodes.has(nodeDefinition.id)
 * SerializedGraph.insertEdge @L77 - D=3, P=4.
 *   1c1=edgeDefinition.metadata.type === 'class-to-class' | 1c2=SerializedGraph.INTERNAL_PROVIDERS.includes( edgeDefinition.metadata.sourceClassToken, ) | 1c3=SerializedGraph.INTERNAL_PROVIDERS.includes( edgeDefinition.metadata.targetClassToken, )
 * SerializedGraph.insertEntrypoint @L102 - D=1, P=2.
 *   1=this.entrypoints.has(parentId)
 * SerializedGraph.insertOrphanedEnhancer @L111 - D=0, P=1.
 * SerializedGraph.insertAttachedEnhancer @L115 - D=0, P=1.
 * SerializedGraph.getNodeById @L121 - D=0, P=1.
 * SerializedGraph.toJSON @L125 - D=2, P=3.
 *   1=this._status
 *   2=this._metadata
 * SerializedGraph.toString @L142 - D=0, P=1.
 * SerializedGraph.replacer @L143 - D=2, P=3.
 *   1=typeof value === 'symbol'
 *   2=typeof value === 'function'
 * SerializedGraph.generateUuidByEdgeDefinition @L152 - D=0, P=1.
 */
import { afterEach, describe, it } from 'vitest';
import { SerializedGraph } from '../../../../packages/core/inspector/serialized-graph.js';
import { DeterministicUuidRegistry } from '../../../../packages/core/inspector/deterministic-uuid-registry.js';
import { ModuleRef } from '../../../../packages/core/injector/module-ref.js';
afterEach(() => DeterministicUuidRegistry.clear());
describe('SerializedGraph', () => {
  describe('insertNode/insertEdge/insertEntrypoint/extras/accessors/serialization', () => {
    it('internal/external nodes, repeated ids, implicit/explicit edge ids and metadata', () => {
      const value: any = new SerializedGraph();
      value.toJSON();
      for (const metadata of [
        { type: 'module' },
        { type: 'provider', token: 'external' },
        { type: 'provider', token: ModuleRef },
      ])
        value.insertNode({
          id: 'node' + metadata.type,
          label: 'fixture',
          metadata,
        });
      for (const metadata of [
        { type: 'module-to-module' },
        {
          type: 'class-to-class',
          sourceClassToken: ModuleRef,
          targetClassToken: 'external',
        },
        {
          type: 'class-to-class',
          sourceClassToken: 'external',
          targetClassToken: ModuleRef,
        },
        {
          type: 'class-to-class',
          sourceClassToken: 'external',
          targetClassToken: 'external',
        },
      ])
        value.insertEdge({ source: 'first', target: 'second', metadata });
      value.insertEdge({
        id: 'explicit',
        source: 'first',
        target: 'second',
        metadata: { type: 'module-to-module' },
      });
      value.insertEntrypoint({ methodName: 'first' }, 'parent');
      value.insertEntrypoint({ methodName: 'second' }, 'parent');
      value.insertOrphanedEnhancer({
        subtype: 'guard',
        ref: Symbol('fixture'),
      });
      value.insertOrphanedEnhancer({ subtype: 'guard', ref: class Fixture {} });
      value.insertAttachedEnhancer('node');
      value.getNodeById('missing');
      value.status = 'partial';
      value.metadata = { cause: { type: 'unknown', error: null } };
      value.toJSON();
      value.toString();
      value.status = undefined;
      value.toJSON();
    });
  });
});
