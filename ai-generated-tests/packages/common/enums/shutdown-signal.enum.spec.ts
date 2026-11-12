import { describe, expect, it } from 'vitest';
import { ShutdownSignal } from '../../../../packages/common/enums/shutdown-signal.enum.js';

const cases: [keyof typeof ShutdownSignal, ShutdownSignal][] = [
  ['SIGHUP', 'SIGHUP'],
  ['SIGINT', 'SIGINT'],
  ['SIGQUIT', 'SIGQUIT'],
  ['SIGILL', 'SIGILL'],
  ['SIGTRAP', 'SIGTRAP'],
  ['SIGABRT', 'SIGABRT'],
  ['SIGBUS', 'SIGBUS'],
  ['SIGFPE', 'SIGFPE'],
  ['SIGSEGV', 'SIGSEGV'],
  ['SIGUSR2', 'SIGUSR2'],
  ['SIGTERM', 'SIGTERM'],
];

describe('ShutdownSignal', () => {
  it.each(cases)('%s is %s', (name, value) => {
    expect(ShutdownSignal[name]).toBe(value);
  });
});
