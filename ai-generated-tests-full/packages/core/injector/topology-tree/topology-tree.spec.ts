import { describe, expect, it } from 'vitest';
import { TopologyTree } from '../../../../../packages/core/injector/topology-tree/topology-tree.js';

function module(name: string, imports: any[] = []) {
  return { id: name, imports } as any;
}

describe('TopologyTree', () => {
  it('xc1(T): assigns increasing depths along imports', () => {
    const leaf = module('leaf');
    const child = module('child', [leaf]);
    const root = module('root', [child]);

    const depths = new Map();
    new TopologyTree(root).walk((mod, depth) => depths.set(mod.id, depth));

    expect(depths).toEqual(
      new Map([
        ['root', 1],
        ['child', 2],
        ['leaf', 3],
      ]),
    );
  });

  it('xc1(F): keeps the deepest path for a shared module', () => {
    const shared = module('shared');
    const shortPath = module('short', [shared]);
    const deep = module('deep', [shared]);
    const mid = module('mid', [deep]);
    const root = module('root', [shortPath, mid]);

    const depths = new Map();
    new TopologyTree(root).walk((mod, depth) => depths.set(mod.id, depth));

    expect(depths.get('shared')).toBe(4);
  });

  it('xc2(T): ignores imports that close a cycle', () => {
    const first = module('first');
    const second = module('second', [first]);
    first.imports = [second];

    const depths = new Map();
    new TopologyTree(first).walk((mod, depth) => depths.set(mod.id, depth));

    expect(depths).toEqual(
      new Map([
        ['first', 1],
        ['second', 2],
      ]),
    );
  });

  it('xc2(F): skips falsy imports', () => {
    const root = module('root', [null, undefined]);

    const depths = new Map();
    new TopologyTree(root).walk((mod, depth) => depths.set(mod.id, depth));

    expect(depths).toEqual(new Map([['root', 1]]));
  });

  it('handles modules without an imports array', () => {
    const root = { id: 'root' } as any;

    const depths = new Map();
    new TopologyTree(root).walk((mod, depth) => depths.set(mod.id, depth));

    expect(depths).toEqual(new Map([['root', 1]]));
  });
});
