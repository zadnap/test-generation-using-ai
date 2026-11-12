import { describe, expect, it } from 'vitest';
import { getHostname } from '../../../../../packages/platform-node/adapters/utils/hostname.util.js';

// CFG (C3) of getHostname:
//   1   !host                                  T/F
//   2c1 host.charCodeAt(0) === 91 ('[')        T/F
//   2c2 host.indexOf(':') === -1               T/F
describe('getHostname', () => {
  it.each([
    ['undefined', undefined, undefined],
    ['empty string', '', undefined],
    ['a bare host', 'example.com', 'example.com'],
    ['a host with a port', 'example.com:8080', 'example.com'],
    ['a host with several colons', 'example.com:8080:90', 'example.com'],
    ['an IPv4 host', '127.0.0.1', '127.0.0.1'],
    ['an IPv4 host with a port', '127.0.0.1:3000', '127.0.0.1'],
    ['an IPv6 literal with a port', '[::1]:3000', '[::1]'],
    ['an IPv6 literal without a port', '[::1]', '[::1]'],
    ['an IPv6 literal with a missing bracket', '[::1', '['],
    ['a bracket without a colon', '[example]', '[example]'],
    ['a leading colon', ':3000', ''],
  ])('should return the host name for %s', (_, host, expected) => {
    expect(getHostname(host)).toBe(expected);
  });
});
