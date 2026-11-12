import { describe, expect, it } from 'vitest';
import { ROUTE_ARGS_METADATA } from '../../../packages/common/internal.js';
import {
  CLOSE_EVENT,
  CONNECTION_EVENT,
  DEFAULT_MAX_CONCURRENT_MESSAGES,
  DISCONNECT_EVENT,
  ERROR_EVENT,
  GATEWAY_METADATA,
  GATEWAY_OPTIONS,
  GATEWAY_SERVER_METADATA,
  MESSAGE_MAPPING_METADATA,
  MESSAGE_METADATA,
  NAMESPACE_METADATA,
  PARAM_ARGS_METADATA,
  PORT_METADATA,
} from '../../../packages/websockets/constants.js';

describe('websockets constants', () => {
  it.each([
    [MESSAGE_MAPPING_METADATA, 'websockets:message_mapping'],
    [MESSAGE_METADATA, 'message'],
    [GATEWAY_SERVER_METADATA, 'websockets:is_socket'],
    [GATEWAY_METADATA, 'websockets:is_gateway'],
    [NAMESPACE_METADATA, 'namespace'],
    [PORT_METADATA, 'port'],
    [GATEWAY_OPTIONS, 'websockets:gateway_options'],
  ])('should expose metadata key %s', (actual, expected) => {
    expect(actual).toBe(expected);
  });

  it.each([
    [CONNECTION_EVENT, 'connection'],
    [DISCONNECT_EVENT, 'disconnect'],
    [CLOSE_EVENT, 'close'],
    [ERROR_EVENT, 'error'],
  ])('should expose event name %s', (actual, expected) => {
    expect(actual).toBe(expected);
  });

  it('should reuse the common route args metadata key', () => {
    expect(PARAM_ARGS_METADATA).toBe(ROUTE_ARGS_METADATA);
  });

  it('should default to 1000 concurrent messages per client', () => {
    expect(DEFAULT_MAX_CONCURRENT_MESSAGES).toBe(1000);
  });
});
