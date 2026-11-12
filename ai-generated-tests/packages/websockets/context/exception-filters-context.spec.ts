import { Catch, UseFilters } from '../../../../packages/common/index.js';
import { NestContainer } from '../../../../packages/core/injector/container.js';
import { describe, expect, it, vi } from 'vitest';
import { ExceptionFiltersContext } from '../../../../packages/websockets/context/exception-filters-context.js';

class CustomException {}

@Catch(CustomException)
class CustomFilter {
  catch() {}
}

describe('ExceptionFiltersContext', () => {
  const create = () =>
    new ExceptionFiltersContext(new NestContainer() as any);

  it('should return a handler without filters when metadata is empty', () => {
    const context = create();
    vi.spyOn(context, 'createContext').mockReturnValue([]);

    const handler = context.create({}, () => undefined, 'module');

    expect((handler as any).filters).toEqual([]);
  });

  it('should attach the filters in reverse order', () => {
    @UseFilters(new CustomFilter())
    class Gateway {}

    const context = create();
    const filter = new CustomFilter();
    const createContext = vi
      .spyOn(context, 'createContext')
      .mockReturnValue([filter] as any);

    const handler = context.create(
      new Gateway(),
      () => undefined,
      'module',
      undefined,
      'inquirer',
    );

    expect(createContext).toHaveBeenCalledWith(
      expect.any(Gateway),
      expect.any(Function),
      expect.anything(),
      expect.anything(),
      'inquirer',
    );
    expect((handler as any).filters).toEqual([filter]);
  });

  it('should have no global metadata', () => {
    expect(create().getGlobalMetadata()).toEqual([]);
  });
});
