/**
 * CFT checklist extracted from packages/core/router/route-conflict-detector.ts.
 * D counts atomic short-circuit decisions and loop/case guards. P = D + 1.
 * && evaluates the next condition only after T. || evaluates it only after F.
 * Each condition needs feasible T/F outcomes. Test inputs below exercise these paths.
 * This static checklist is separate from measured V8 branch coverage.
 * Optional chaining, nullish fallback and exceptional edges remain visible in the HTML report.
 * joinText @L69 - D=0, P=1.
 * callback @L70 - D=1, P=2.
 *   1=token.type === 'text'
 * RouteConflictDetector.tokenizePath @L86 - D=1, P=2.
 *   1=!tokens
 * RouteConflictDetector.pathsHaveSameShape @L101 - D=0, P=1.
 * RouteConflictDetector.shapeOf @L105 - D=0, P=1.
 * RouteConflictDetector.callback @L106 - D=1, P=2.
 *   1=key === 'name'
 * RouteConflictDetector.pathsCanOverlap @L120 - D=0, P=1.
 * RouteConflictDetector.comparablePathsCanOverlap @L127 - D=2, P=3.
 *   1c1=!leftPath.leadingText.startsWith(rightPath.leadingText) | 1c2=!rightPath.leadingText.startsWith(leftPath.leadingText)
 * RouteConflictDetector.callback @L138 - D=0, P=1.
 * RouteConflictDetector.callback @L139 - D=0, P=1.
 * RouteConflictDetector.segmentListsCanOverlap @L148 - D=3, P=4.
 *   1=leftSegments.length !== rightSegments.length
 *   2=leftSegments.length < rightSegments.length
 *   3=!shorterEndsInWildcard
 * RouteConflictDetector.callback @L174 - D=2, P=3.
 *   1=!canOverlap
 *   2=!RouteConflictDetector.segmentsCanOverlap( leftSegment, rightSegments[segmentIndex], )
 * RouteConflictDetector.detect @L194 - D=0, P=1.
 * RouteConflictDetector.callback @L201 - D=0, P=1.
 * RouteConflictDetector.callback @L209 - D=5, P=6.
 *   1=!RouteConflictDetector.methodsCanOverlap( earlierRoute.method, laterRoute.method, )
 *   2=!RouteConflictDetector.versionsCanOverlap( earlierRoute.version, laterRoute.version, versioningOptions, )
 *   3=!RouteConflictDetector.hostsCanOverlap( earlierRoute.host, laterRoute.host, )
 *   4=!RouteConflictDetector.comparablePathsCanOverlap( comparablePaths.get(earlierRoute.path)!, comparablePaths.get(laterRoute.path)!, )
 *   5=isIdentical
 * RouteConflictDetector.handle @L265 - D=3, P=4.
 *   1c1=conflicts.length === 0 | 1c2=policy === undefined
 *   2=errorMessages.length > 0
 * RouteConflictDetector.callback @L274 - D=2, P=3.
 *   1=policyForKind === 'off'
 *   2=policyForKind === 'warn'
 * RouteConflictDetector.filterSortResolvedShadows @L311 - D=0, P=1.
 * RouteConflictDetector.callback @L316 - D=0, P=1.
 * RouteConflictDetector.callback @L318 - D=1, P=2.
 *   1=conflict.kind !== 'shadow'
 * RouteConflictDetector.segmentsCanOverlap @L330 - D=12, P=13.
 *   1c1=leftSegment.kind === 'wildcard' | 1c2=rightSegment.kind === 'wildcard'
 *   2c1=leftSegment.kind === 'param' | 2c2=rightSegment.kind === 'param'
 *   3c1=leftSegment.kind === 'mixed' | 3c2=rightSegment.kind === 'mixed'
 *   4c1=leftSegment.start.startsWith(rightSegment.start) | 4c2=rightSegment.start.startsWith(leftSegment.start) | 4c3=leftSegment.end.endsWith(rightSegment.end) | 4c4=rightSegment.end.endsWith(leftSegment.end)
 *   5=leftSegment.kind === 'mixed'
 *   6=rightSegment.kind === 'mixed'
 * RouteConflictDetector.toComparablePath @L361 - D=3, P=4.
 *   1c1=!tokens | 1c2=RouteConflictDetector.countGroups(tokens) > MAX_EXPANDED_GROUPS
 *   2=firstNonText === -1
 * RouteConflictDetector.callback @L376 - D=0, P=1.
 * RouteConflictDetector.callback @L378 - D=0, P=1.
 * RouteConflictDetector.callback @L380 - D=0, P=1.
 * RouteConflictDetector.toComparableSegment @L390 - D=1, P=2.
 *   1=segment.kind !== 'mixed'
 * RouteConflictDetector.callback @L404 - D=0, P=1.
 * RouteConflictDetector.callback @L408 - D=0, P=1.
 * RouteConflictDetector.parseTokens @L413 - D=0, P=1.
 * RouteConflictDetector.countGroups @L424 - D=0, P=1.
 * RouteConflictDetector.callback @L426 - D=1, P=2.
 *   1=token.type === 'group'
 * RouteConflictDetector.expandGroups @L434 - D=0, P=1.
 * RouteConflictDetector.callback @L438 - D=1, P=2.
 *   1=token.type !== 'group'
 * RouteConflictDetector.callback @L440 - D=0, P=1.
 * RouteConflictDetector.callback @L443 - D=0, P=1.
 * RouteConflictDetector.callback @L445 - D=0, P=1.
 * RouteConflictDetector.flattenGroups @L452 - D=0, P=1.
 * RouteConflictDetector.callback @L453 - D=1, P=2.
 *   1=token.type === 'group'
 * RouteConflictDetector.toSegments @L460 - D=0, P=1.
 * RouteConflictDetector.callback @L462 - D=1, P=2.
 *   1=part.token.type !== 'text'
 * RouteConflictDetector.callback @L467 - D=2, P=3.
 *   1=index > 0
 *   2=text.length > 0
 * RouteConflictDetector.callback @L480 - D=0, P=1.
 * RouteConflictDetector.callback @L481 - D=0, P=1.
 * RouteConflictDetector.classifySegment @L484 - D=5, P=6.
 *   1=tokens[0].type === 'wildcard'
 *   2=tokens.every(token => token.type === 'text')
 *   3=requiredParts.length > 0
 *   4c1=otherParts.length === 0 | 4c2=onlyPart.token.type === 'param'
 * RouteConflictDetector.callback @L485 - D=0, P=1.
 * RouteConflictDetector.callback @L491 - D=0, P=1.
 * RouteConflictDetector.callback @L494 - D=0, P=1.
 * RouteConflictDetector.callback @L499 - D=0, P=1.
 * RouteConflictDetector.splitPath @L512 - D=0, P=1.
 * RouteConflictDetector.callback @L515 - D=0, P=1.
 * RouteConflictDetector.callback @L516 - D=4, P=5.
 *   1=rawSegment.startsWith('*')
 *   2c1=rawSegment.startsWith('{*') | 2c2=rawSegment.endsWith('}')
 *   3=rawSegment.startsWith(':')
 * RouteConflictDetector.methodsCanOverlap @L530 - D=2, P=3.
 *   1c1=leftMethod === RequestMethod.ALL | 1c2=rightMethod === RequestMethod.ALL
 * RouteConflictDetector.versionsCanOverlap @L540 - D=10, P=11.
 *   1=!versioningOptions
 *   2=versioningOptions.type === VersioningType.URI
 *   3c1=leftVersion === undefined | 3c2=leftVersion === VERSION_NEUTRAL
 *   4c1=rightVersion === undefined | 4c2=rightVersion === VERSION_NEUTRAL
 *   5c1=leftMatchesAnyVersion | 5c2=rightMatchesAnyVersion
 *   6=Array.isArray(leftVersion)
 *   7=Array.isArray(rightVersion)
 * RouteConflictDetector.callback @L560 - D=0, P=1.
 * RouteConflictDetector.hostsCanOverlap @L565 - D=4, P=5.
 *   1c1=leftHost === undefined | 1c2=rightHost === undefined
 *   2=Array.isArray(leftHost)
 *   3=Array.isArray(rightHost)
 * RouteConflictDetector.callback @L574 - D=0, P=1.
 * RouteConflictDetector.callback @L575 - D=0, P=1.
 * RouteConflictDetector.hostValuesCanMatchSameRequest @L584 - D=4, P=5.
 *   1c1=leftIsRegExp | 1c2=rightIsRegExp
 *   2=leftIsRegExp
 *   3=rightIsRegExp
 * RouteConflictDetector.routesAreIdentical @L606 - D=4, P=5.
 *   1c1=leftRoute.method === rightRoute.method | 1c2=leftRoute.path === rightRoute.path | 1c3=RouteConflictDetector.hostsAreIdentical( leftRoute.host, rightRoute.host, ) | 1c4=RouteConflictDetector.versionsAreIdentical( leftRoute.version, rightRoute.version, versioningOptions, )
 * RouteConflictDetector.hostsAreIdentical @L626 - D=8, P=9.
 *   1c1=leftHost === undefined | 1c2=rightHost === undefined
 *   2c1=leftHost === undefined | 2c2=rightHost === undefined
 *   3=Array.isArray(leftHost)
 *   4=Array.isArray(rightHost)
 *   5c1=isSubset(leftHosts, rightHosts) | 5c2=isSubset(rightHosts, leftHosts)
 * RouteConflictDetector.isSubset @L639 - D=0, P=1.
 * RouteConflictDetector.callback @L643 - D=0, P=1.
 * RouteConflictDetector.callback @L644 - D=0, P=1.
 * RouteConflictDetector.hostValuesAreIdentical @L651 - D=4, P=5.
 *   1c1=leftValue instanceof RegExp | 1c2=rightValue instanceof RegExp
 *   2c1=leftValue.source === rightValue.source | 2c2=leftValue.flags === rightValue.flags
 * RouteConflictDetector.versionsAreIdentical @L664 - D=6, P=7.
 *   1c1=!versioningOptions | 1c2=versioningOptions.type === VersioningType.URI
 *   2=leftVersion === rightVersion
 *   3=Array.isArray(leftVersion)
 *   4=Array.isArray(rightVersion)
 *   5=leftValues.length !== rightValues.length
 * RouteConflictDetector.callback @L685 - D=0, P=1.
 * RouteConflictDetector.forEachUniquePair @L688 - D=0, P=1.
 * RouteConflictDetector.callback @L692 - D=0, P=1.
 * RouteConflictDetector.callback @L693 - D=0, P=1.
 * RouteConflictDetector.describeConflict @L699 - D=1, P=2.
 *   1=conflict.kind === 'duplicate'
 */
import { describe, it, vi } from 'vitest';
import { RequestMethod, VERSION_NEUTRAL, VersioningType } from '@nestjs/common';
import { RouteConflictDetector } from '../../../../packages/core/router/route-conflict-detector.js';

const detector: any = RouteConflictDetector;
function route(extra: any = {}) {
  return {
    path: '/users/:id',
    method: RequestMethod.GET,
    methodName: 'handle',
    instanceWrapper: { name: 'Controller' },
    ...extra,
  };
}
describe('RouteConflictDetector', () => {
  describe('tokenizePath/parseTokens/flattenGroups/toSegments/classifySegment/splitPath', () => {
    it.each([
      '',
      '/',
      '//users//',
      '/users/:id',
      '/files/*path',
      '/users{/:id}',
      '/:id{.:format}',
      '/{:id}',
      '/v:version',
      '/:name.:ext',
      '/static*path',
      '/files/*',
      '/:name:ext',
      '/{*path}/broken[',
      '/{*path',
      '/:id/broken[',
    ])('pattern %s', pattern => {
      detector.tokenizePath(pattern);
    });
  });
  describe('pathsHaveSameShape', () => {
    it.each([
      ['/a/:id', '/a/:name'],
      ['/a/:id', '/b/:id'],
      ['/bad[', '/a'],
    ])('shapes %s/%s', (a, b) => {
      detector.pathsHaveSameShape(a, b);
    });
  });
  describe('pathsCanOverlap/toComparablePath/countGroups/expandGroups/toComparableSegment/comparablePathsCanOverlap/segmentListsCanOverlap/segmentsCanOverlap', () => {
    it.each([
      ['/users', '/other'],
      ['/users', '/users/:id'],
      ['/users/:id', '/users'],
      ['/a/*path', '/a/b/c'],
      ['/a/b/c', '/a/*path'],
      ['/a/*path', '/a/:id'],
      ['/a/:id', '/a/fixed'],
      ['/a/fixed', '/a/:id'],
      ['/a', '/a'],
      ['/a/:name.txt', '/a/file.txt'],
      ['/a/file.txt', '/a/:name.txt'],
      ['/a/x:id.txt', '/a/:id.txt'],
      ['/a/:id.txt', '/a/x:id.txt'],
      ['/a/x:id.txt', '/a/y:id.txt'],
      ['/a/:id.txt', '/a/:id.json'],
      ['/a/:id.txt', '/a/:id.long.txt'],
      ['/a/:id.long.txt', '/a/:id.txt'],
      ['/a{/:id}', '/a'],
      ['/files/*', '/files/:name:ext'],
      ['/a{/b}{/c}{/d}{/e}{/f}{/g}{/h}', '/a'],
      ['/x/:id/a', '/x/:name/b/c'],
    ])('overlap %s/%s', (a, b) => {
      detector.pathsCanOverlap(a, b);
    });
  });
  describe('detect/forEachUniquePair/methodsCanOverlap/routesAreIdentical', () => {
    it.each([
      [{}, {}],
      [{ method: RequestMethod.ALL }, {}],
      [{}, { method: RequestMethod.ALL }],
      [{}, { method: RequestMethod.POST }],
      [{}, { path: '/different' }],
      [{}, { path: '/users/:name' }],
      [{ host: 'a' }, { host: 'b' }],
      [{ version: '1' }, { version: '2' }],
    ])('pair %j/%j', (a, b) => {
      detector.detect([route(a), route(b)], {
        type: VersioningType.HEADER,
        header: 'version',
      });
    });
    it('empty and URI-version routes', () => {
      detector.detect([], undefined);
      detector.detect([route({ version: '1' }), route({ version: '2' })], {
        type: VersioningType.URI,
      });
    });
  });
  describe('versionsCanOverlap/versionsAreIdentical', () => {
    it.each([
      [undefined, undefined],
      [VERSION_NEUTRAL, '1'],
      ['1', undefined],
      ['1', VERSION_NEUTRAL],
      ['1', '1'],
      ['1', '2'],
      [
        ['1', '2'],
        ['2', '1'],
      ],
      [['1'], ['1', '2']],
      [
        ['1', '2'],
        ['2', '3'],
      ],
    ])('versions %j/%j', (a, b) => {
      detector.versionsCanOverlap(a, b, undefined);
      detector.versionsCanOverlap(a, b, { type: VersioningType.URI });
      detector.versionsCanOverlap(a, b, { type: VersioningType.HEADER });
      detector.versionsAreIdentical(a, b, undefined);
      detector.versionsAreIdentical(a, b, { type: VersioningType.URI });
      detector.versionsAreIdentical(a, b, { type: VersioningType.HEADER });
    });
  });
  describe('hostsCanOverlap/hostValuesCanMatchSameRequest/hostsAreIdentical/hostValuesAreIdentical', () => {
    it.each([
      [undefined, undefined],
      [undefined, 'a'],
      ['a', undefined],
      ['a', 'a'],
      ['a', 'b'],
      [/a/g, 'a'],
      ['a', /a/y],
      [/a/, /b/],
      [/a/g, /a/i],
      [/a/, /a/],
      [
        ['a', 'b'],
        ['b', 'a'],
      ],
      [['a'], ['a', 'b']],
      [
        ['a', 'c'],
        ['a', 'b'],
      ],
    ])('hosts %j/%j', (a, b) => {
      detector.hostsCanOverlap(a, b);
      detector.hostsAreIdentical(a, b);
    });
  });
  describe('handle/describeConflict/filterSortResolvedShadows', () => {
    it.each([
      undefined,
      {},
      { duplicate: 'off', shadow: 'off' },
      { duplicate: 'warn', shadow: 'warn' },
      { duplicate: 'error', shadow: 'error' },
    ])('policy %j', policy => {
      const first = route();
      const second = route({ path: '/users/fixed' });
      const conflicts = [
        { kind: 'duplicate', winner: first, shadowed: second },
        { kind: 'shadow', winner: second, shadowed: first },
        { kind: 'shadow', winner: first, shadowed: second },
      ];
      detector.handle([], policy, { warn: vi.fn() });
      try {
        detector.handle(conflicts, policy, { warn: vi.fn() });
      } catch (error) {
        if (!(error instanceof Error)) throw error;
      }
      detector.filterSortResolvedShadows(conflicts, [first, second]);
      detector.filterSortResolvedShadows(conflicts, []);
    });
  });
});
