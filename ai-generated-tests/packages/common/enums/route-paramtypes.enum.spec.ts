import { describe, expect, it } from 'vitest';
import { RouteParamtypes } from '../../../../packages/common/enums/route-paramtypes.enum.js';

const cases: [keyof typeof RouteParamtypes, RouteParamtypes][] = [
  ['REQUEST', 0],
  ['RESPONSE', 1],
  ['NEXT', 2],
  ['BODY', 3],
  ['QUERY', 4],
  ['PARAM', 5],
  ['HEADERS', 6],
  ['SESSION', 7],
  ['FILE', 8],
  ['FILES', 9],
  ['HOST', 10],
  ['IP', 11],
  ['RAW_BODY', 12],
  ['ACK', 13],
  ['COOKIES', 14],
  ['SIGNED_COOKIES', 15],
];

describe('RouteParamtypes', () => {
  it.each(cases)('%s is %i', (name, value) => {
    expect(RouteParamtypes[name]).toBe(value);
  });
});
