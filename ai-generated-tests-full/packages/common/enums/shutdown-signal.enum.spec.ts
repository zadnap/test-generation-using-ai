import { describe, expect, it } from 'vitest';
import { ShutdownSignal } from '../../../../packages/common/enums/shutdown-signal.enum.js';

describe('ShutdownSignal', () => {
  it('maps signals to their names', () => {
    expect(ShutdownSignal.SIGHUP).toBe('SIGHUP');
    expect(ShutdownSignal.SIGINT).toBe('SIGINT');
    expect(ShutdownSignal.SIGTERM).toBe('SIGTERM');
  });
});
