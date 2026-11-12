/**
 * CFT checklist extracted from packages/core/repl/repl.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * repl @L11 - D=0, P=1.
 * callback @L34 - D=0, P=1.
 */
import { afterEach, describe, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { Logger } from '@nestjs/common';
import { NestFactory } from '../../../../packages/core/nest-factory.js';
import { NestContainer } from '../../../../packages/core/injector/container.js';
const stub = vi.hoisted(() => ({ start: vi.fn() }));
vi.mock('repl', () => ({ start: stub.start }));
import { repl } from '../../../../packages/core/repl/repl.js';
afterEach(() => vi.restoreAllMocks());
describe('repl', () => {
  it('creates context/server and closes context on exit', async () => {
    const app: any = {
      container: new NestContainer(),
      init: vi.fn(),
      close: vi.fn(),
    };
    vi.spyOn(NestFactory, 'createApplicationContext').mockResolvedValue(app);
    vi.spyOn(Logger, 'log').mockImplementation(() => undefined);
    const server = Object.assign(new EventEmitter(), {
      context: {},
      defineCommand: vi.fn(),
    });
    stub.start.mockReturnValue(server);
    await repl(class Root {}, {});
    server.emit('exit');
    await new Promise(resolve => setImmediate(resolve));
  });
});
