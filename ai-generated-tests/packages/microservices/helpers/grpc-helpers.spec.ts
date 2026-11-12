import { describe, expect, it, vi } from 'vitest';
import { InvalidGrpcPackageDefinitionMissingPackageDefinitionException } from '../../../../packages/microservices/errors/invalid-grpc-package-definition-missing-package-definition.exception.js';
import { InvalidGrpcPackageDefinitionMutexException } from '../../../../packages/microservices/errors/invalid-grpc-package-definition-mutex.exception.js';
import { getGrpcPackageDefinition } from '../../../../packages/microservices/helpers/grpc-helpers.js';

/**
 * C3 decisions of getGrpcPackageDefinition:
 * D1: file && packageDefinition            -> T (throw mutex) / F
 *     1c1: file truthy                      -> T / F (c2 skipped)
 *     1c2: packageDefinition truthy         -> T / F
 * D2: !file && !packageDefinition          -> T (throw missing) / F
 *     2c1: !file                            -> T / F (c2 skipped)
 *     2c2: !packageDefinition               -> T / F
 * D3: packageDefinition || loadSync(...)   -> T (definition wins) / F (loader used)
 *
 * No infeasible paths: every file/packageDefinition combination is reachable
 * with a stubbed proto loader, so no sockets or filesystem access is needed.
 */

const loader = { includeDirs: ['/proto'] };
const loadedDefinition = { loaded: true };

function makeProtoLoader() {
  const loadSync = vi.fn(() => loadedDefinition);
  return { loadSync };
}

describe('getGrpcPackageDefinition', () => {
  // D1 c1(T) c2(T)
  it('D1 c1(T) c2(T) - both protoPath and packageDefinition throws the mutex exception', () => {
    const protoLoader = makeProtoLoader();

    expect(() =>
      getGrpcPackageDefinition(
        { protoPath: 'a.proto', packageDefinition: {} },
        protoLoader,
      ),
    ).toThrow(InvalidGrpcPackageDefinitionMutexException);
    expect(protoLoader.loadSync).not.toHaveBeenCalled();
  });

  // D1 c1(T) c2(F), D2 c1(F), D3 F
  it('D1 c1(T) c2(F) D2 c1(F) - only protoPath loads the file through the loader', () => {
    const protoLoader = makeProtoLoader();

    const definition = getGrpcPackageDefinition(
      { protoPath: 'a.proto', loader },
      protoLoader,
    );

    expect(definition).toBe(loadedDefinition);
    expect(protoLoader.loadSync).toHaveBeenCalledOnce();
    expect(protoLoader.loadSync).toHaveBeenCalledWith('a.proto', loader);
  });

  // D1 c1(F), D2 c1(T) c2(T)
  it('D2 c1(T) c2(T) - neither protoPath nor packageDefinition throws the missing exception', () => {
    const protoLoader = makeProtoLoader();

    expect(() =>
      getGrpcPackageDefinition({ package: 'pkg' }, protoLoader),
    ).toThrow(InvalidGrpcPackageDefinitionMissingPackageDefinitionException);
    expect(protoLoader.loadSync).not.toHaveBeenCalled();
  });

  // D1 c1(F), D2 c1(T) c2(F), D3 T
  it('D2 c1(T) c2(F) D3(T) - packageDefinition alone is returned as is', () => {
    const protoLoader = makeProtoLoader();
    const packageDefinition = { pkg: { Service: {} } };

    const definition = getGrpcPackageDefinition(
      { packageDefinition },
      protoLoader,
    );

    expect(definition).toBe(packageDefinition);
    expect(protoLoader.loadSync).not.toHaveBeenCalled();
  });

  // D1 c1(F) with empty-ish values that are still truthy combinations
  it('D1 c1(F) D2 c1(T) c2(F) - packageDefinition falsy-looking but present is still used', () => {
    const protoLoader = makeProtoLoader();

    // `packageDefinition: {}` is truthy, so without protoPath it is returned.
    const definition = getGrpcPackageDefinition(
      { packageDefinition: {} },
      protoLoader,
    );

    expect(definition).toEqual({});
    expect(protoLoader.loadSync).not.toHaveBeenCalled();
  });
});
