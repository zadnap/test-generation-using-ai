import { describe, expect, it } from 'vitest';
import { MergeWithValues } from '../../../../packages/common/utils/merge-with-values.util.js';

class Base {
  constructor(
    public a: number,
    public b: string,
  ) {}
}

describe('MergeWithValues (C3)', () => {
  it('creates a subclass that forwards constructor arguments', () => {
    const Mixed = MergeWithValues<typeof Base>({ extra: true })(Base);
    const instance = new Mixed(1, 'two');

    expect(instance).toBeInstanceOf(Base);
    expect(instance).toBeInstanceOf(Mixed);
    expect(instance.a).toBe(1);
    expect(instance.b).toBe('two');
  });

  it('merges the data into the prototype', () => {
    const Mixed = MergeWithValues<typeof Base>({
      extra: 'value',
      nested: { x: 1 },
    })(Base);

    expect(Mixed.prototype.extra).toBe('value');
    expect(Mixed.prototype.nested).toEqual({ x: 1 });
    expect(new Mixed(0, '').extra).toBe('value');
  });

  it('sets a generated class name', () => {
    const data = { extra: true };
    const Mixed = MergeWithValues<typeof Base>(data)(Base);
    expect(Mixed.name).toBe(`Base${JSON.stringify(data)}`);
  });

  it('supports empty data', () => {
    const Mixed = MergeWithValues<typeof Base>({})(Base);
    expect(Mixed.name).toBe('Base{}');
    expect(new Mixed(1, 'a')).toBeInstanceOf(Base);
  });
});
