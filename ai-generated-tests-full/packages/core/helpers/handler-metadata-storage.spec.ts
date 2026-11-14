import { describe, expect, it } from 'vitest';
import { HandlerMetadataStorage } from '../../../../packages/core/helpers/handler-metadata-storage.js';

describe('HandlerMetadataStorage', () => {
  it('stores and retrieves metadata per class and method', () => {
    class Controller {}
    const storage = new HandlerMetadataStorage();
    const metadata = { argsLength: 1 } as any;

    storage.set(new Controller() as any, 'handler', metadata);

    expect(storage.get(new Controller() as any, 'handler')).toBe(metadata);
    expect(storage.get(new Controller() as any, 'other')).toBeUndefined();
  });

  it('keeps same-named classes separate', () => {
    const First = class Controller {};
    const Second = class Controller {};
    const storage = new HandlerMetadataStorage();
    const metadata = { argsLength: 1 } as any;

    storage.set(new First() as any, 'handler', metadata);

    expect(storage.get(new Second() as any, 'handler')).toBeUndefined();
  });

  it('xc1(T): initializes the method map on the first write', () => {
    class Controller {}
    const storage = new HandlerMetadataStorage();
    const first = { argsLength: 1 } as any;
    const second = { argsLength: 2 } as any;

    storage.set(new Controller() as any, 'first', first);
    storage.set(new Controller() as any, 'second', second);

    expect(storage.get(new Controller() as any, 'first')).toBe(first);
    expect(storage.get(new Controller() as any, 'second')).toBe(second);
  });

  it('xc1(F): ignores targets without a constructor', () => {
    const storage = new HandlerMetadataStorage();
    const target = Object.create(null);

    storage.set(target as any, 'handler', { argsLength: 0 } as any);

    expect(storage.get(target as any, 'handler')).toBeUndefined();
  });
});
