import { describe, expect, it } from 'vitest';
import { getMediaTypeVersion } from '../../../../../packages/platform-node/adapters/utils/get-media-type-version.util.js';

// CFG (C3) of getMediaTypeVersion:
//   1c1 acceptHeader ?? []              T/F (short-circuit inside flatMap)
//   2   trimmedParameter.startsWith     T/F
//   3c1 version.startsWith('"')         T/F
//   3c2 version.endsWith('"')           T/F (only evaluated when 3c1 is T)
const KEY = 'v=';

describe('getMediaTypeVersion', () => {
  it.each([
    ['undefined header', undefined, undefined],
    ['empty string header', '', undefined],
    ['no version parameter', 'application/json', undefined],
    ['single version', 'application/json;v=2', '2'],
    ['version after another parameter', 'application/json;charset=utf-8;v=3', '3'],
    ['first matching range wins', 'text/html;v=1, application/json;v=2', '1'],
    ['version with spaces around', 'application/json ; v= 7 ', ' 7'],
    ['parameter that does not start with the key', 'application/json;notv=2', undefined],
    ['key must match at the start of the parameter', 'application/json;foo=v=2', undefined],
    ['quoted version', 'application/json;v="4"', '4'],
    ['quoted version with escaped quote', 'application/json;v="a\\"b"', 'a"b'],
    ['quoted version with escaped backslash', 'application/json;v="a\\\\b"', 'a\\b'],
    ['unterminated quote swallows the separator', 'application/json;v="4;x=1', '"4;x=1'],
    ['separator inside quoted value', 'application/json;note="a;b";v=5', '5'],
    ['comma inside quoted value', 'application/json;note="a,b";v=6', '6'],
    ['escaped quote keeps the string quoted', 'application/json;note="a\\"b,c";v=8', '8'],
  ])('should resolve the version for %s', (_, header, expected) => {
    expect(getMediaTypeVersion(header, KEY)).toBe(expected);
  });

  it('should accept an array of header values', () => {
    expect(getMediaTypeVersion(['text/html', 'application/json;v=9'], KEY)).toBe(
      '9',
    );
  });

  it('should accept an empty array', () => {
    expect(getMediaTypeVersion([], KEY)).toBeUndefined();
  });

  it('should use the provided key rather than a hard-coded one', () => {
    expect(getMediaTypeVersion('application/json;version=1', 'version=')).toBe(
      '1',
    );
  });

  it('should ignore a quoted parameter that is not the version', () => {
    expect(
      getMediaTypeVersion('application/json;q="a;b";v=10', KEY),
    ).toBe('10');
  });

  it('should treat an empty quoted version as an empty string', () => {
    expect(getMediaTypeVersion('application/json;v=""', KEY)).toBe('');
  });

  it('should not read a version that follows an unterminated quote', () => {
    expect(getMediaTypeVersion('application/json;x=";v=1', KEY)).toBeUndefined();
  });
});
