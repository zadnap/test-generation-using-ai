import { describe, expect, it } from 'vitest';
import { ClientsContainer } from '../../../packages/microservices/container.js';

/**
 * C3 decisions of ClientsContainer: none - getAllClients/addClient/clear are
 * straight-line methods with no conditions. They are covered so the container
 * contract (read the array, append, reset) is pinned.
 */
describe('ClientsContainer', () => {
  it('getAllClients returns the same live array instance', () => {
    const container = new ClientsContainer();
    const first = container.getAllClients();

    expect(first).toEqual([]);
    container.addClient({ client: 'a' } as any);

    expect(container.getAllClients()).toBe(first);
  });
});

describe('ClientsContainer.addClient', () => {
  it('appends clients in insertion order', () => {
    const container = new ClientsContainer();
    const clientA = { name: 'a' } as any;
    const clientB = { name: 'b' } as any;

    container.addClient(clientA);
    container.addClient(clientB);

    expect(container.getAllClients()).toEqual([clientA, clientB]);
  });
});

describe('ClientsContainer.clear', () => {
  it('resets to a new empty array', () => {
    const container = new ClientsContainer();
    container.addClient({ name: 'a' } as any);
    const before = container.getAllClients();

    container.clear();

    expect(container.getAllClients()).toEqual([]);
    expect(container.getAllClients()).not.toBe(before);
  });
});
