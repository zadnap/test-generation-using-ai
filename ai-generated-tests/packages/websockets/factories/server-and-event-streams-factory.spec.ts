import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { ServerAndEventStreamsFactory } from '../../../../packages/websockets/factories/server-and-event-streams-factory.js';

describe('ServerAndEventStreamsFactory', () => {
  it('should expose the server through a replaying init stream', async () => {
    const server = { id: 'server' };
    const host = ServerAndEventStreamsFactory.create(server);

    expect(host.server).toBe(server);
    expect(await firstValueFrom(host.init)).toBe(server);
    expect(await firstValueFrom(host.init)).toBe(server);
  });

  it('should create independent connection and disconnect streams', () => {
    const host = ServerAndEventStreamsFactory.create({});

    expect(host.connection).not.toBe(host.disconnect);
    expect(host.connection.closed).toBe(false);
    expect(host.disconnect.closed).toBe(false);
  });
});
