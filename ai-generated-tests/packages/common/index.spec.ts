import { describe, expect, it } from 'vitest';
import * as CommonIndex from '../../../packages/common/index.js';
import '../../../packages/common/interfaces/exceptions/index.js';
import '../../../packages/common/file-stream/interfaces/index.js';
import '../../../packages/common/interfaces/controllers/index.js';
import '../../../packages/common/interfaces/exceptions/exception-filter-metadata.interface.js';
import '../../../packages/common/interfaces/exceptions/rpc-exception-filter-metadata.interface.js';
import '../../../packages/common/interfaces/external/transformer-package.interface.js';
import '../../../packages/common/interfaces/external/validator-package.interface.js';
import '../../../packages/common/interfaces/microservices/nest-microservice-options.interface.js';
import '../../../packages/common/pipes/file/file-validator-context.interface.js';
import '../../../packages/common/pipes/file/interfaces/index.js';

describe('Common Barrel Exports', () => {
  it('should export all public API', () => {
    expect(CommonIndex.Injectable).toBeDefined();
    expect(CommonIndex.Controller).toBeDefined();
    expect(CommonIndex.Module).toBeDefined();
  });
});
