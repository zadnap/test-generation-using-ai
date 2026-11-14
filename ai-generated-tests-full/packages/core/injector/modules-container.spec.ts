import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { ModulesContainer } from '../../../../packages/core/injector/modules-container.js';

describe('ModulesContainer', () => {
  it('creates a 21 character application id', () => {
    const container = new ModulesContainer();

    expect(container.applicationId).toHaveLength(21);
  });

  it('xc1(T): finds a module by id', () => {
    const container = new ModulesContainer();
    const module = { id: 'module-id' } as any;
    container.set('token', module);

    expect(container.getById('module-id')).toBe(module);
  });

  it('xc1(F): returns undefined for an unknown id', () => {
    const container = new ModulesContainer();

    expect(container.getById('missing')).toBeUndefined();
  });

  it('xc2(T): emits added RPC targets', async () => {
    const container = new ModulesContainer();
    const target = { name: 'target' };

    const received = firstValueFrom(container.getRpcTargetRegistry());
    container.addRpcTarget(target);

    await expect(received).resolves.toBe(target);
  });
});
