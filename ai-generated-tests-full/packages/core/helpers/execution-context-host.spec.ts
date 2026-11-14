import { describe, expect, it } from 'vitest';
import { ExecutionContextHost } from '../../../../packages/core/helpers/execution-context-host.js';

class Controller {}

describe('ExecutionContextHost', () => {
  it('exposes the constructor arguments', () => {
    const handler = () => undefined;
    const context = new ExecutionContextHost(['a', 'b'], Controller, handler);

    expect(context.getArgs()).toEqual(['a', 'b']);
    expect(context.getArgByIndex(1)).toBe('b');
    expect(context.getClass()).toBe(Controller);
    expect(context.getHandler()).toBe(handler);
  });

  it('xc1(T): updates the context type when truthy', () => {
    const context = new ExecutionContextHost([]);

    context.setType('rpc');

    expect(context.getType()).toBe('rpc');
  });

  it('xc1(F): keeps the current context type for a falsy value', () => {
    const context = new ExecutionContextHost([]);

    context.setType('');

    expect(context.getType()).toBe('http');
  });

  it('switches to the RPC arguments host', () => {
    const context = new ExecutionContextHost(['data', 'ctx']);
    const rpc = context.switchToRpc();

    expect(rpc.getData()).toBe('data');
    expect(rpc.getContext()).toBe('ctx');
  });

  it('switches to the HTTP arguments host', () => {
    const context = new ExecutionContextHost(['req', 'res', 'next']);
    const http = context.switchToHttp();

    expect(http.getRequest()).toBe('req');
    expect(http.getResponse()).toBe('res');
    expect(http.getNext()).toBe('next');
  });

  it('switches to the WS arguments host', () => {
    const context = new ExecutionContextHost(['client', 'data', 'pattern']);
    const ws = context.switchToWs();

    expect(ws.getClient()).toBe('client');
    expect(ws.getData()).toBe('data');
    expect(ws.getPattern()).toBe('pattern');
  });
});
