import { describe, expect, it } from 'vitest';
import { MODULE_METADATA } from '../../../../packages/common/constants.js';
import { MetadataScanner } from '../../../../packages/core/metadata-scanner.js';
import { DiscoveryModule } from '../../../../packages/core/discovery/discovery-module.js';
import { DiscoveryService } from '../../../../packages/core/discovery/discovery-service.js';

describe('DiscoveryModule', () => {
  it('registers and exports the discovery providers', () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, DiscoveryModule);
    const exports = Reflect.getMetadata(MODULE_METADATA.EXPORTS, DiscoveryModule);

    expect(providers).toEqual([MetadataScanner, DiscoveryService]);
    expect(exports).toEqual([MetadataScanner, DiscoveryService]);
  });
});
