import { describe, expect, it } from 'vitest';
import { VERSION_NEUTRAL } from '../../../../packages/common/interfaces/version-options.interface.js';
import { RequestMethod } from '../../../../packages/common/enums/request-method.enum.js';
import {
  CONTROLLER_MAPPING_MESSAGE,
  INVALID_EXECUTION_CONTEXT,
  MODULE_INIT_MESSAGE,
  ROUTE_MAPPED_MESSAGE,
  VERSIONED_CONTROLLER_MAPPING_MESSAGE,
  VERSIONED_ROUTE_MAPPED_MESSAGE,
} from '../../../../packages/core/helpers/messages.js';

describe('messages', () => {
  it('formats the module initialization message', () => {
    expect(MODULE_INIT_MESSAGE`${'CatsModule'}`).toBe(
      'CatsModule dependencies initialized',
    );
  });

  it('formats a mapped route message', () => {
    expect(ROUTE_MAPPED_MESSAGE('/cats', RequestMethod.GET)).toBe(
      'Mapped {/cats, GET} route',
    );
  });

  it('xc1(T): formats a versioned route message with an array of versions', () => {
    expect(
      VERSIONED_ROUTE_MAPPED_MESSAGE('/cats', RequestMethod.GET, [
        '1',
        '2',
      ]),
    ).toBe('Mapped {/cats, GET} (version: 1,2) route');
  });

  it('xc1(F): wraps a single version in the versioned route message', () => {
    expect(
      VERSIONED_ROUTE_MAPPED_MESSAGE('/cats', RequestMethod.GET, '1'),
    ).toBe('Mapped {/cats, GET} (version: 1) route');
  });

  it('xc2(T): renders the neutral version label', () => {
    expect(
      VERSIONED_ROUTE_MAPPED_MESSAGE('/cats', RequestMethod.GET, [
        VERSION_NEUTRAL,
      ]),
    ).toBe('Mapped {/cats, GET} (version: Neutral) route');
  });

  it('formats the controller mapping message', () => {
    expect(CONTROLLER_MAPPING_MESSAGE('CatsController', '/cats')).toBe(
      'CatsController {/cats}:',
    );
  });

  it('xc1(T): formats a versioned controller message with an array', () => {
    expect(
      VERSIONED_CONTROLLER_MAPPING_MESSAGE('CatsController', '/cats', [
        '1',
        '2',
      ]),
    ).toBe('CatsController {/cats} (version: 1,2):');
  });

  it('xc1(F): wraps a single version in the versioned controller message', () => {
    expect(
      VERSIONED_CONTROLLER_MAPPING_MESSAGE('CatsController', '/cats', '1'),
    ).toBe('CatsController {/cats} (version: 1):');
  });

  it('xc2(T): renders the neutral label for a controller', () => {
    expect(
      VERSIONED_CONTROLLER_MAPPING_MESSAGE(
        'CatsController',
        '/cats',
        VERSION_NEUTRAL,
      ),
    ).toBe('CatsController {/cats} (version: Neutral):');
  });

  it('formats the invalid execution context message', () => {
    expect(INVALID_EXECUTION_CONTEXT('getRequest', 'rpc')).toBe(
      'Calling getRequest is not allowed in this context. Your current execution context is "rpc".',
    );
  });
});
