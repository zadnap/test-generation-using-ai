import { describe, expect, it } from 'vitest';
import { RequestMethod } from '../../../../packages/common/enums/request-method.enum.js';

describe('RequestMethod', () => {
  it('assigns the expected numeric values', () => {
    expect(RequestMethod.GET).toBe(0);
    expect(RequestMethod.POST).toBe(1);
    expect(RequestMethod.PUT).toBe(2);
    expect(RequestMethod.DELETE).toBe(3);
    expect(RequestMethod.QUERY).toBe(16);
  });
});
