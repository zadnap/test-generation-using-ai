import { describe, expect, it } from 'vitest';
import { RequestMethod } from '../../../../packages/common/enums/request-method.enum.js';

const cases: [keyof typeof RequestMethod, RequestMethod][] = [
  ['GET', 0],
  ['POST', 1],
  ['PUT', 2],
  ['DELETE', 3],
  ['PATCH', 4],
  ['ALL', 5],
  ['OPTIONS', 6],
  ['HEAD', 7],
  ['SEARCH', 8],
  ['PROPFIND', 9],
  ['PROPPATCH', 10],
  ['MKCOL', 11],
  ['COPY', 12],
  ['MOVE', 13],
  ['LOCK', 14],
  ['UNLOCK', 15],
  ['QUERY', 16],
];

describe('RequestMethod', () => {
  it.each(cases)('%s is %i', (name, value) => {
    expect(RequestMethod[name]).toBe(value);
  });
});
