import { describe, expect, it, vi } from 'vitest';
import { RouteParamtypes } from '../../../../packages/common/enums/route-paramtypes.enum.js';
import { PipesConsumer } from '../../../../packages/core/pipes/pipes-consumer.js';

describe('PipesConsumer', () => {
  const metadata = {
    type: RouteParamtypes.BODY,
    metatype: String,
    data: 'field',
  };

  it('xc1(T): applies pipes sequentially', async () => {
    const consumer = new PipesConsumer();
    const first = { transform: vi.fn(async (value: unknown) => `${value}-1`) };
    const second = { transform: vi.fn((value: unknown) => `${value}-2`) };

    await expect(
      consumer.apply('value', metadata, [first, second] as any),
    ).resolves.toBe('value-1-2');
  });

  it('xc1(F): returns the value without pipes', async () => {
    const consumer = new PipesConsumer();

    await expect(consumer.apply('value', metadata, [])).resolves.toBe('value');
  });

  it('xc2(T): awaits a thenable input before piping', async () => {
    const consumer = new PipesConsumer();
    const pipe = { transform: vi.fn((value: unknown) => value) };

    await expect(
      consumer.apply(Promise.resolve('value'), metadata, [pipe] as any),
    ).resolves.toBe('value');
    expect(pipe.transform).toHaveBeenCalledWith('value', {
      metatype: String,
      type: 'body',
      data: 'field',
      schema: undefined,
    });
  });

  it('xc2(F): passes a non-thenable input directly', async () => {
    const consumer = new PipesConsumer();
    const pipe = { transform: (value: unknown) => value };

    await expect(consumer.apply('value', metadata, [pipe] as any)).resolves.toBe(
      'value',
    );
  });

  it('handles null input', async () => {
    const consumer = new PipesConsumer();
    const pipe = { transform: (value: unknown) => value };

    await expect(consumer.apply(null, metadata, [pipe] as any)).resolves.toBe(
      null,
    );
  });

  it('handles a function input with a then method', async () => {
    const consumer = new PipesConsumer();
    const thenable = Object.assign(() => undefined, {
      then: (resolve: (value: string) => void) => resolve('resolved'),
    });
    const pipe = { transform: (value: unknown) => value };

    await expect(consumer.apply(thenable as any, metadata, [pipe] as any)).resolves.toBe(
      'resolved',
    );
  });

  it('exposes applyPipes with explicit metadata', async () => {
    const consumer = new PipesConsumer();
    const pipe = { transform: (value: unknown) => `${value}!` };

    await expect(
      consumer.applyPipes('value', metadata as any, [pipe] as any),
    ).resolves.toBe('value!');
  });
});
