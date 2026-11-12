import { describe, expect, it } from 'vitest';
import { getMediaTypeVersion } from '../../../../../packages/platform-fastify/adapters/utils/get-media-type-version.util.js';

/**
 * CFG (C3) for getMediaTypeVersion:
 *   1  for each char of splitOutsideQuotes
 *      1c1 isQuoted && character === '\\'
 *      1c2 character === '\\'            (evaluated only when 1c1 True)
 *      2   character === '"'
 *      3c1 character === separator
 *      3c2 !isQuoted                     (evaluated only when 3c1 True)
 *   2  for each media range
 *   3  for each parameter
 *      3  trimmedParameter.startsWith(key)
 *      4c1 version.startsWith('"') && version.endsWith('"')
 *      4c2 version.endsWith('"')         (evaluated only when 4c1 True)
 *   5  acceptHeader ?? []  (nullish coalesce)
 * All feasible T/F are exercised below.
 */
describe('getMediaTypeVersion', () => {
  it.each([
    ['undefined header', undefined, 'v', undefined],
    ['null header', null as any, 'v', undefined],
    ['empty header', '', 'v', undefined],
    ['empty array header', [], 'v', undefined],
    ['no parameters', 'application/json', 'v', undefined],
    ['parameter without the key', 'application/json;charset=utf-8', 'v', undefined],
    ['version parameter', 'application/json;v=2', 'v=', '2'],
    ['version parameter with spaces and a bare key', 'application/json; v = 2', 'v', ' = 2'],
    ['version parameter after others', 'application/json;charset=utf-8;v=3', 'v=', '3'],
    ['first match wins', 'application/json;v=1, text/html;v=2', 'v=', '1'],
    ['second media range match', 'text/html, application/json;v=2', 'v=', '2'],
    ['custom key', 'application/json;version=4', 'version=', '4'],
    ['empty version value', 'application/json;v=', 'v=', ''],
    ['key is a prefix of another parameter', 'application/json;verbose=1', 'v', 'erbose=1'],
    ['quoted version', 'application/json;v="2"', 'v=', '2'],
    ['quoted version with escaped quote', 'application/json;v="a\\"b"', 'v=', 'a"b'],
    ['quoted version with escaped backslash', 'application/json;v="a\\\\b"', 'v=', 'a\\b'],
    ['quoted version with separator inside', 'application/json;v="a,b"', 'v=', 'a,b'],
    ['quoted version with semicolon inside', 'application/json;v="a;b"', 'v=', 'a;b'],
    ['opening quote without closing quote', 'application/json;v="2', 'v=', '"2'],
    ['unterminated quote starts later', 'application/json;note="x;v=2', 'v', undefined],
    ['array header first match', ['text/html', 'application/json;v=5'], 'v=', '5'],
    ['array header no match', ['text/html', 'text/plain'], 'v', undefined],
    ['escaped quote outside quotes', 'application/json;v=a\\"b', 'v=', 'a\\"b'],
  ])(
    'should return the version for %s',
    (_name, header, key, expected) => {
      expect(getMediaTypeVersion(header as any, key)).toBe(expected);
    },
  );

  it('should split only on separators outside quoted strings', () => {
    // The comma inside the quoted parameter must not split the media range.
    expect(
      getMediaTypeVersion('text/plain;note="a,b";v=7, text/html', 'v='),
    ).toBe('7');
  });

  it('should treat an escaped quote as a literal, not as a toggle', () => {
    // Without escape handling, the escaped quote would close the string and
    // the following quote would reopen it, hiding the ";v=2" parameter.
    expect(getMediaTypeVersion('x;a="q\\"";v=2', 'v=')).toBe('2');
  });

  it('should ignore separators inside an unterminated quoted string', () => {
    expect(getMediaTypeVersion('x;note="a;v=1', 'v=')).toBeUndefined();
  });

  it('should scan escaped characters at the end of a quoted string', () => {
    expect(getMediaTypeVersion('x;note="a\\', 'v')).toBeUndefined();
  });
});
