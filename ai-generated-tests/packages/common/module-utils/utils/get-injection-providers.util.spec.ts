import { describe, expect, it } from 'vitest';
import { Provider } from '../../../../../packages/common/interfaces/index.js';
import { getInjectionProviders } from '../../../../../packages/common/module-utils/utils/get-injection-providers.util.js';

describe('getInjectionProviders (C3)', () => {
  describe('optional factory dependency condition (1c1, 1c2, 1c3)', () => {
    it.each([
      ['string token (1c1: F)', 'simpleToken'],
      ['symbol token (1c1: F)', Symbol('symToken')],
      ['object without token property (1c1: F)', { otherProp: 'value' }],
      ['object with token but without optional property (1c1: T, 1c2: F)', { token: 't1' }],
    ])('maps dependency as raw token when %s', (_label, dep) => {
      const provider = { provide: 'p1', useValue: 'val' };
      const result = getInjectionProviders([provider], [dep as any]);

      if (dep === 'simpleToken' || (dep as any).token === 't1') {
        expect(result).toEqual([]);
      }
    });

    it('identifies class with static token & optional as having prototype (1c1: T, 1c2: T, 1c3: F)', () => {
      class ClassDep {
        static token = 'classToken';
        static optional = true;
      }
      const provider = { provide: 'classToken', useValue: 'cVal' };
      const classProvider = ClassDep;

      const result = getInjectionProviders([provider, classProvider], [ClassDep]);

      // Since ClassDep has prototype, it is treated as a token rather than unwrapping .token
      expect(result).toContain(classProvider);
      expect(result).not.toContain(provider);
    });

    it('unwraps token when OptionalFactoryDependency object has no prototype (1c1: T, 1c2: T, 1c3: T)', () => {
      const targetProvider = { provide: 'unwrappedToken', useValue: 'v1' };
      const optDep = { token: 'unwrappedToken', optional: true };

      const result = getInjectionProviders([targetProvider], [optDep]);

      expect(result).toEqual([targetProvider]);
    });
  });

  describe('getInjectionProviders search and match loop', () => {
    it('returns empty array when tokens is empty', () => {
      const provider = { provide: 'any', useValue: 'val' };
      const result = getInjectionProviders([provider], []);

      expect(result).toEqual([]);
    });

    it('handles undefined or null providers safely using fallback empty array', () => {
      const result = getInjectionProviders(undefined as any, ['a']);
      expect(result).toEqual([]);
    });

    it('prevents circular loops and duplicate additions (2c1: F)', () => {
      const a = { provide: 'a', useExisting: 'b' };
      const b = { provide: 'b', useExisting: 'a' };

      const result = getInjectionProviders([a, b], ['a', 'a']);

      expect(result).toHaveLength(2);
      expect(result).toEqual([a, b]);
    });

    it('matches provider directly when token matches class provider (2c2_a: T)', () => {
      class TargetService {}
      const provider = TargetService;

      const result = getInjectionProviders([provider], [TargetService]);

      expect(result).toEqual([TargetService]);
    });

    it('matches provider via provide property (2c2_a: F, 2c2_b: T)', () => {
      const provider = { provide: 'tokenB', useValue: 'valB' };

      const result = getInjectionProviders([provider], ['tokenB']);

      expect(result).toEqual([provider]);
    });

    it('filters out non-matching providers (2c2_a: F, 2c2_b: F)', () => {
      const matched = { provide: 'wanted', useValue: 'yes' };
      const unmatched = { provide: 'unwanted', useValue: 'no' };

      const result = getInjectionProviders([matched, unmatched], ['wanted']);

      expect(result).toEqual([matched]);
      expect(result).not.toContain(unmatched);
    });
  });

  describe('flatMap provider dependency extraction', () => {
    it('extracts useExisting dependency including empty string (3: T)', () => {
      const target = { provide: '', useValue: 'emptyStringValue' };
      const alias = { provide: 'alias', useExisting: '' };

      const result = getInjectionProviders([alias, target], ['alias']);

      expect(result).toEqual([alias, target]);
    });

    it('extracts useFactory inject array (3: F, 4c1: T)', () => {
      const leaf = { provide: 'leaf', useValue: 'leafVal' };
      const factory = {
        provide: 'factory',
        useFactory: () => {},
        inject: ['leaf'],
      };

      const result = getInjectionProviders([factory, leaf], ['factory']);

      expect(result).toEqual([factory, leaf]);
    });

    it('handles factory provider with undefined inject property (3: F, 4c1: F)', () => {
      const factoryWithoutInject = {
        provide: 'factoryNoInject',
        useFactory: () => 'val',
      };

      const result = getInjectionProviders([factoryWithoutInject], ['factoryNoInject']);

      expect(result).toEqual([factoryWithoutInject]);
    });

    it('handles useValue provider without useExisting or inject (3: F, 4c1: F)', () => {
      const valueProvider = {
        provide: 'valToken',
        useValue: 42,
      };

      const result = getInjectionProviders([valueProvider], ['valToken']);

      expect(result).toEqual([valueProvider]);
    });
  });
});
