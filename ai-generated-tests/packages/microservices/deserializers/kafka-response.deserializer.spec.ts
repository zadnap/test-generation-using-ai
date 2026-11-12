import { describe, expect, it } from 'vitest';
import { KafkaHeaders } from '../../../../packages/microservices/enums/kafka-headers.enum.js';
import { KafkaResponseDeserializer } from '../../../../packages/microservices/deserializers/kafka-response.deserializer.js';

/**
 * CFG / C3 decisions of KafkaResponseDeserializer.deserialize:
 * D1: !isUndefined(message.headers[KafkaHeaders.NEST_ERR])          single condition
 * D2: !isUndefined(message.headers[KafkaHeaders.NEST_IS_DISPOSED])  single condition
 * D3: !isUndefined(message.headers[KafkaHeaders.NEST_NO_RESPONSE])  single condition
 *
 * The correlation id is read with `.toString()`, so a Buffer header is
 * converted to its string form.
 * Infeasible: none.
 */
describe('KafkaResponseDeserializer', () => {
  const deserializer = new KafkaResponseDeserializer();

  const message = (
    headers: Record<string, any> = {},
    value: any = 'payload',
  ) => ({
    headers: {
      [KafkaHeaders.CORRELATION_ID]: Buffer.from('corr-1'),
      ...headers,
    },
    value,
  });

  describe('deserialize', () => {
    it('D1 T - an error header wins over every other flag', () => {
      expect(
        deserializer.deserialize(
          message({
            [KafkaHeaders.NEST_ERR]: 'boom',
            [KafkaHeaders.NEST_IS_DISPOSED]: 'true',
          }),
        ),
      ).toEqual({ id: 'corr-1', err: 'boom', isDisposed: true });
    });

    it('D1 T - an empty string error is defined and therefore an error', () => {
      expect(
        deserializer.deserialize(
          message({ [KafkaHeaders.NEST_ERR]: '' }, undefined),
        ),
      ).toEqual({ id: 'corr-1', err: '', isDisposed: true });
    });

    it('D1 F + D2 T + D3 F - a disposed record still carries the response', () => {
      expect(
        deserializer.deserialize(
          message({ [KafkaHeaders.NEST_IS_DISPOSED]: 'true' }, { ok: true }),
        ),
      ).toEqual({ id: 'corr-1', response: { ok: true }, isDisposed: true });
    });

    it('D1 F + D2 T + D3 T - a no-response record has no response key', () => {
      const result = deserializer.deserialize(
        message(
          {
            [KafkaHeaders.NEST_IS_DISPOSED]: 'true',
            [KafkaHeaders.NEST_NO_RESPONSE]: 'true',
          },
          null,
        ),
      );

      expect(result).toEqual({ id: 'corr-1', isDisposed: true });
      expect(result).not.toHaveProperty('response');
    });

    it('D1 F + D2 F - a regular message is not disposed', () => {
      expect(deserializer.deserialize(message())).toEqual({
        id: 'corr-1',
        response: 'payload',
        isDisposed: false,
      });
    });

    it('converts a string correlation id as well', () => {
      const result = deserializer.deserialize({
        headers: {
          [KafkaHeaders.CORRELATION_ID]: 'plain-id',
          [KafkaHeaders.NEST_IS_DISPOSED]: 'false',
        },
        value: 'payload',
      });

      expect(result).toEqual({
        id: 'plain-id',
        response: 'payload',
        isDisposed: true,
      });
    });

    it('ignores the options argument', () => {
      expect(
        deserializer.deserialize(message(), { channel: 'ignored' }),
      ).toEqual({
        id: 'corr-1',
        response: 'payload',
        isDisposed: false,
      });
    });
  });
});
