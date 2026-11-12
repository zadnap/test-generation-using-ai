/**
 * CFT checklist extracted from packages/core/helpers/context-utils.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * ContextUtils.mapParamType @L22 - D=0, P=1.
 * ContextUtils.reflectCallbackParamtypes @L27 - D=0, P=1.
 * ContextUtils.reflectCallbackMetadata @L34 - D=0, P=1.
 * ContextUtils.reflectPassthrough @L42 - D=0, P=1.
 * ContextUtils.getArgumentsLength @L50 - D=1, P=2.
 *   1=keys.length
 * ContextUtils.callback @L52 - D=0, P=1.
 * ContextUtils.createNullArray @L56 - D=1, P=2.
 *   1=i < length
 * ContextUtils.mergeParamsMetatypes @L62 - D=1, P=2.
 *   1=!paramtypes
 * ContextUtils.callback @L69 - D=0, P=1.
 * ContextUtils.getCustomFactory @L75 - D=1, P=2.
 *   1=isFunction(factory)
 * ContextUtils.callback @L81 - D=0, P=1.
 * ContextUtils.callback @L82 - D=0, P=1.
 * ContextUtils.getContextFactory @L85 - D=2, P=3.
 *   1c1=instance | 1c2=instance.constructor as Type<unknown>
 * ContextUtils.callback @L91 - D=0, P=1.
 */
import { describe, it } from 'vitest';
import {
  PARAMTYPES_METADATA,
  RESPONSE_PASSTHROUGH_METADATA,
} from '@nestjs/common/internal';
import { ContextUtils } from '../../../../packages/core/helpers/context-utils.js';

describe('ContextUtils', () => {
  const utils = new ContextUtils();
  describe('mapParamType', () => {
    it.each(['', '3:0', 'custom:2:extra'])('maps %s', key => {
      utils.mapParamType(key);
    });
  });
  describe('reflection methods', () => {
    it.each([false, true])('metadata present %s', present => {
      class Controller {
        handle() {}
      }
      const controller = new Controller();
      if (present) {
        Reflect.defineMetadata(
          PARAMTYPES_METADATA,
          [String],
          controller,
          'handle',
        );
        Reflect.defineMetadata('custom', { value: 1 }, Controller, 'handle');
        Reflect.defineMetadata(
          RESPONSE_PASSTHROUGH_METADATA,
          true,
          Controller,
          'handle',
        );
      }
      utils.reflectCallbackParamtypes(controller, 'handle');
      utils.reflectCallbackMetadata(controller, 'handle', 'custom');
      utils.reflectPassthrough(controller, 'handle');
    });
  });
  describe('getArgumentsLength', () => {
    it.each([[], ['a', 'b']].map(keys => ({ keys })))(
      'keys $keys, 1(T/F)',
      ({ keys }) => {
        utils.getArgumentsLength(keys, { a: { index: 0 }, b: { index: 4 } });
      },
    );
  });
  describe('createNullArray', () => {
    it.each([0, 3])('loop with length %i', length => {
      utils.createNullArray(length);
    });
  });
  describe('mergeParamsMetatypes', () => {
    it.each([undefined, [], [String]].map(types => ({ types })))(
      'types $types, 1(T/F)',
      ({ types }) => {
        utils.mergeParamsMetatypes([{ index: 0 } as any], types as any);
      },
    );
  });
  describe('getCustomFactory', () => {
    it.each([undefined, () => undefined])('callable %s, 1(T/F)', factory => {
      utils.getCustomFactory(
        factory as any,
        'field',
        utils.getContextFactory('http'),
      )(1, 2);
    });
  });
  describe('getContextFactory', () => {
    it.each([undefined, {}])('instance %j, 1(T/F)', instance => {
      utils.getContextFactory('rpc', instance, () => undefined)([1, 2]);
    });
  });
});
