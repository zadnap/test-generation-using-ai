import { describe, expect, it } from 'vitest';
import { KafkaHeaders } from '../../../../packages/microservices/enums/kafka-headers.enum.js';
import { MaxPacketLengthExceededException } from '../../../../packages/microservices/errors/max-packet-length-exceeded.exception.js';
import { KafkaParser } from '../../../../packages/microservices/helpers/kafka-parser.js';

/**
 * C3 decisions:
 * constructor
 * D1: (config && config.keepBinary) || false
 *     1c1: config truthy -> T / F
 *     1c2: config.keepBinary truthy -> T / F
 * D2: config?.maxMessageSize ?? DEFAULT       -> set / unset
 * parse
 * D3: messageSize > maxMessageSize            -> T (throw) / F
 * D4: !keepBinary                             -> T (decode value) / F (keep Buffer)
 * D5: !isNil(data.key)                        -> T (decode key) / F
 * D6: !isNil(data.headers)                    -> T (decode each header) / F (headers = {})
 * D7: TRANSPORT_HEADERS.includes(key)         -> T (decodeAsString) / F (decode)
 * D8: decodeAsString isNil                    -> T (null) / F (toString)
 * decode
 * D9: isNil(value)                            -> T (null) / F
 * D10: Buffer.isBuffer(value) && length > 0 && readUInt8(0) === 0
 *     10c1: Buffer.isBuffer                   -> T / F
 *     10c2: length > 0                        -> T / F
 *     10c3: first byte === 0                  -> T / F
 * D11: startChar === '{' || startChar === '[' -> T / F
 *     11c1: '{' -> T / F ; 11c2: '[' -> T / F
 * D12: JSON.parse throws (catch)              -> T / F
 * getMessageSize
 * D13: data.key?.length ?? 0                  -> present / absent
 * D14: keepBinary ? 0 : value length          -> T / F
 * D15: data.value?.length ?? 0                -> present / absent
 * D16: data.headers ?? {}                     -> present / absent
 * D17: Array.isArray(value)                   -> T / F
 * D18: headerValue?.length ?? 0               -> present / null
 *
 * No infeasible paths: all conditions are reachable through parse()/decode().
 */

class ExposedKafkaParser extends KafkaParser {
  public size(data: any): number {
    return this.getMessageSize(data);
  }
}

describe('KafkaParser constructor', () => {
  // D1 c1(F), D2(F)
  it('D1 c1(F) D2(F) - defaults: keepBinary false, 16 MiB message limit', () => {
    const parser = new KafkaParser() as any;
    expect(parser.keepBinary).toBe(false);
    expect(parser.maxMessageSize).toBe(16 * 1024 * 1024);
  });

  // D1 c1(T) c2(T)
  it('D1 c1(T) c2(T) - keepBinary enabled by config', () => {
    expect((new KafkaParser({ keepBinary: true }) as any).keepBinary).toBe(
      true,
    );
  });

  // D1 c1(T) c2(F)
  it('D1 c1(T) c2(F) - keepBinary explicitly false', () => {
    expect((new KafkaParser({ keepBinary: false }) as any).keepBinary).toBe(
      false,
    );
  });

  // D2 T
  it('D2(T) - a configured maxMessageSize replaces the default', () => {
    expect((new KafkaParser({ maxMessageSize: 5 }) as any).maxMessageSize).toBe(
      5,
    );
  });

  // D2 F with a config that does not set maxMessageSize
  it('D2(F) - a config without maxMessageSize keeps the default', () => {
    expect((new KafkaParser({ keepBinary: true }) as any).maxMessageSize).toBe(
      16 * 1024 * 1024,
    );
  });
});

describe('KafkaParser.parse', () => {
  // D3 T
  it('D3(T) - a message over maxMessageSize is rejected', () => {
    const parser = new KafkaParser({ maxMessageSize: 3 });
    expect(() => parser.parse({ value: Buffer.from('abcd') })).toThrow(
      MaxPacketLengthExceededException,
    );
  });

  // D3 F, boundary
  it('D3(F) - a message exactly at maxMessageSize is accepted', () => {
    const parser = new KafkaParser({ maxMessageSize: 3 });
    expect(parser.parse({ value: Buffer.from('abc') }).value).toBe('abc');
  });

  // D4 T
  it('D4(T) - the value is decoded when keepBinary is false', () => {
    const parser = new KafkaParser();
    expect(
      parser.parse({ value: Buffer.from(JSON.stringify({ a: 1 })) }).value,
    ).toEqual({ a: 1 });
  });

  // D4 F
  it('D4(F) - the value is left untouched when keepBinary is true', () => {
    const parser = new KafkaParser({ keepBinary: true });
    const value = Buffer.from('raw-bytes');
    expect(parser.parse({ value }).value).toBe(value);
  });

  // D5 T / F
  it.each([
    ['D5(T) - a Buffer key is decoded', Buffer.from('key-1'), 'key-1'],
    [
      'D5(T) - JSON-looking key is decoded to an object',
      Buffer.from('{"k":1}'),
      { k: 1 },
    ],
    ['D5(F) - undefined key stays undefined', undefined, undefined],
    ['D5(F) - null key stays null', null, null],
  ])('%s', (_title, key, expected) => {
    const parser = new KafkaParser();
    expect(parser.parse({ key, value: Buffer.from('v') }).key).toEqual(
      expected,
    );
  });

  // D6 F
  it('D6(F) - missing headers become an empty object', () => {
    const parser = new KafkaParser();
    expect(parser.parse({ value: Buffer.from('v') })).toEqual({
      value: 'v',
      headers: {},
    });
  });

  // D6 T, D7 T
  it('D7(T) - transport headers are always decoded as strings', () => {
    const parser = new KafkaParser();
    const parsed = parser.parse({
      value: Buffer.from('v'),
      headers: {
        [KafkaHeaders.CORRELATION_ID]: Buffer.from('{"a":1}'),
        [KafkaHeaders.REPLY_TOPIC]: Buffer.from('["t"]'),
        [KafkaHeaders.REPLY_PARTITION]: Buffer.from('3'),
      },
    });

    expect(parsed.headers).toEqual({
      [KafkaHeaders.CORRELATION_ID]: '{"a":1}',
      [KafkaHeaders.REPLY_TOPIC]: '["t"]',
      [KafkaHeaders.REPLY_PARTITION]: '3',
    });
  });

  // D7 F
  it('D7(F) - other headers go through decode()', () => {
    const parser = new KafkaParser();
    const parsed = parser.parse({
      value: Buffer.from('v'),
      headers: {
        plain: Buffer.from('text'),
        json: Buffer.from('{"n":2}'),
        [KafkaHeaders.REPLY_TOPIC]: Buffer.from('topic'),
      },
    });

    expect(parsed.headers).toEqual({
      plain: 'text',
      json: { n: 2 },
      [KafkaHeaders.REPLY_TOPIC]: 'topic',
    });
  });

  // D8 T
  it('D8(T) - a nil transport header is decoded to null', () => {
    const parser = new KafkaParser();
    const parsed = parser.parse({
      value: Buffer.from('v'),
      headers: {
        [KafkaHeaders.REPLY_TOPIC]: null,
        other: null,
      },
    });

    expect(parsed.headers).toEqual({
      [KafkaHeaders.REPLY_TOPIC]: null,
      other: null,
    });
  });

  it('does not mutate the original message or its headers object', () => {
    const parser = new KafkaParser();
    const original = {
      value: Buffer.from('{"a":1}'),
      headers: { h: Buffer.from('x') },
    };
    const parsed = parser.parse(original);

    expect(original.value).toBeInstanceOf(Buffer);
    expect(original.headers.h).toBeInstanceOf(Buffer);
    expect(parsed.headers).not.toBe(original.headers);
  });
});

describe('KafkaParser.getMessageSize', () => {
  // D13 T/F, D14 F, D15 T/F, D16 T, D17 T/F, D18 T/F
  it('counts key, value and header names/values, arrays included', () => {
    const parser = new ExposedKafkaParser();
    const size = parser.size({
      key: Buffer.from('ab'),
      value: Buffer.from('cde'),
      headers: {
        h: Buffer.from('x'),
        arr: [Buffer.from('yy'), null],
      },
    });

    // 2 (key) + 3 (value) + 1 ('h') + 1 + 3 ('arr') + 2 + 0
    expect(size).toBe(12);
  });

  // D13(F) key absent, D15(F) value absent, D16(F) headers absent
  it('returns 0 for a message without key, value or headers', () => {
    expect(new ExposedKafkaParser().size({})).toBe(0);
  });

  // D14 T
  it('ignores the value when keepBinary is set', () => {
    const parser = new ExposedKafkaParser({ keepBinary: true });
    expect(
      parser.size({
        key: Buffer.from('ab'),
        value: Buffer.from('cde'),
        headers: { h: Buffer.from('x'), arr: [Buffer.from('yy'), null] },
      }),
    ).toBe(9);
  });

  // D18 T with a non-array header value
  it('counts a single (non-array) header value', () => {
    expect(
      new ExposedKafkaParser().size({ headers: { abc: Buffer.from('12345') } }),
    ).toBe(8);
  });
});

describe('KafkaParser.decode', () => {
  // D9 T
  it('D9(T) - nil values decode to null', () => {
    const parser = new KafkaParser();
    expect(parser.decode(undefined as any)).toBeNull();
    expect(parser.decode(null as any)).toBeNull();
  });

  // D10 c1(T) c2(T) c3(T)
  it('D10 c1(T) c2(T) c3(T) - a leading zero byte means a schema payload, returned as is', () => {
    const parser = new KafkaParser();
    const binary = Buffer.from([0, 1, 2, 3]);
    expect(parser.decode(binary)).toBe(binary);
  });

  // D10 c1(T) c2(F)
  it('D10 c1(T) c2(F) - an empty Buffer decodes to an empty string', () => {
    const parser = new KafkaParser();
    expect(parser.decode(Buffer.alloc(0))).toBe('');
  });

  // D10 c1(T) c2(T) c3(F)
  it('D10 c1(T) c3(F) - a non-zero first byte is decoded as text', () => {
    const parser = new KafkaParser();
    expect(parser.decode(Buffer.from([1, 2, 3]))).toBe(
      Buffer.from([1, 2, 3]).toString(),
    );
  });

  // D10 c1(F), D11 c1(T)
  it('D10 c1(F) D11 c1(T) - a string starting with "{" is parsed as JSON', () => {
    const parser = new KafkaParser();
    expect(parser.decode('{"a":1}' as any)).toEqual({ a: 1 });
  });

  // D11 c1(F) c2(T)
  it('D11 c1(F) c2(T) - a string starting with "[" is parsed as JSON', () => {
    const parser = new KafkaParser();
    expect(parser.decode('[1,2]' as any)).toEqual([1, 2]);
  });

  // D11 both(F)
  it('D11 c1(F) c2(F) - a plain string is returned untouched', () => {
    const parser = new KafkaParser();
    expect(parser.decode('hello' as any)).toBe('hello');
  });

  // D12 T
  it('D12(T) - invalid JSON is returned as the raw string', () => {
    const parser = new KafkaParser();
    expect(parser.decode('{oops' as any)).toBe('{oops');
    expect(parser.decode('[oops' as any)).toBe('[oops');
  });

  // D12 F
  it('D12(F) - valid JSON in a Buffer is parsed', () => {
    const parser = new KafkaParser();
    expect(parser.decode(Buffer.from('{"ok":true}'))).toEqual({ ok: true });
  });
});
