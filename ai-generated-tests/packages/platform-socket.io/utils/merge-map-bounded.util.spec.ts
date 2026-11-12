import {
  EMPTY,
  from,
  of,
  Subject,
  Subscription,
  throwError,
  toArray,
  lastValueFrom,
} from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { mergeMapBounded } from '../../../../packages/platform-socket.io/utils/merge-map-bounded.util.js';

/**
 * C3 notes for `mergeMapBounded` (decision nodes after splitting atomic
 * conditions, short-circuit respected):
 *
 * 1  `if (isDraining)`                              -> 1(T) / 1(F)
 * 2  `while (head && active < concurrent && !closed)` -> 2c1(T/F) 2c2(T/F) 2c3(T/F)
 * 3  `if (onBacklog && isBacklogged !== !!head)`    -> 3c1(T/F) 3c2(T/F)
 * 4  `if (isSourceComplete && !head && active===0)` -> 4c1(T/F) 4c2(T/F) 4c3(T/F)
 * 5  `tail = head ? ... : ...`                       -> 5(T/F)
 */
describe('mergeMapBounded (C3)', () => {
  describe('drain loop / isDraining', () => {
    it.each([
      ['concurrent = 1', 1, [1, 10, 2, 20, 3, 30]],
      ['concurrent = 2', 2, [1, 10, 2, 20, 3, 30]],
      ['concurrent = Infinity', Infinity, [1, 10, 2, 20, 3, 30]],
    ])(
      'merge values and re-enter drain synchronously (%s): 1(T), 1(F), 2c1(T), 2c2(T), 2c3(F)',
      async (_label, concurrent, expected) => {
        const result = await lastValueFrom(
          from([1, 2, 3]).pipe(
            mergeMapBounded(value => of(value, value * 10), concurrent),
            toArray(),
          ),
        );
        expect(result).toEqual(expected);
      },
    );

    it('does not loop when head is empty: 2c1(F)', () => {
      const project = vi.fn(() => EMPTY);
      const complete = vi.fn();

      EMPTY.pipe(mergeMapBounded(project, 1)).subscribe({ complete });

      expect(project).not.toHaveBeenCalled();
      expect(complete).toHaveBeenCalledTimes(1);
    });

    it('stops starting inner observables while the limit is reached: 2c2(F)', () => {
      const source$ = new Subject<number>();
      const inners: Subject<number>[] = [];
      const started: number[] = [];

      source$.pipe(
        mergeMapBounded(value => {
          started.push(value);
          return (inners[value] = new Subject<number>());
        }, 1),
      ).subscribe();

      source$.next(0);
      source$.next(1);
      source$.next(2);

      expect(started).toEqual([0]);

      inners[0].complete();
      expect(started).toEqual([0, 1]);
    });

    it('stops the loop once the subscriber is closed: 2c3(F)', () => {
      const source$ = new Subject<number>();
      let subscription: Subscription | undefined;
      let calls = 0;

      subscription = source$.pipe(
        mergeMapBounded(() => {
          calls++;
          subscription!.unsubscribe();
          return EMPTY;
        }, 1),
      ).subscribe();

      source$.next(0);

      expect(calls).toBe(1);
      expect(subscription.closed).toBe(true);
    });
  });

  describe('backlog notification (node 3)', () => {
    it('skips backlog reporting when onBacklog is not provided: 3c1(F)', () => {
      const source$ = new Subject<number>();
      const project = vi.fn(() => new Subject<never>());

      source$.pipe(mergeMapBounded(project, 1)).subscribe();
      source$.next(0);
      source$.next(1);

      expect(project).toHaveBeenCalledTimes(1);
    });

    it('reports only transitions: 3c1(T), 3c2(F) and 3c2(T)', () => {
      const source$ = new Subject<number>();
      const inners: Subject<never>[] = [];
      const onBacklog = vi.fn();

      source$.pipe(
        mergeMapBounded(
          value => (inners[value] = new Subject<never>()),
          1,
          onBacklog,
        ),
      ).subscribe();

      source$.next(0);
      // no waiting value -> isBacklogged(false) !== !!head(false) is false
      expect(onBacklog).not.toHaveBeenCalled();

      source$.next(1);
      source$.next(2);
      // transition false -> true
      expect(onBacklog.mock.calls).toEqual([[true]]);

      // inner[0] completes, inner[1] starts and a value still waits:
      // true !== true is false, so no extra notification
      inners[0].complete();
      expect(onBacklog.mock.calls).toEqual([[true]]);

      inners[1].complete();
      inners[2].complete();
      // transition true -> false
      expect(onBacklog.mock.calls).toEqual([[true], [false]]);
    });

    it('reports a backlog that is already active without repeating it: 3c2(F) with head set', () => {
      const source$ = new Subject<number>();
      const inners: Subject<never>[] = [];
      const onBacklog = vi.fn();

      source$.pipe(
        mergeMapBounded(
          value => (inners[value] = new Subject<never>()),
          1,
          onBacklog,
        ),
      ).subscribe();

      source$.next(0);
      source$.next(1);
      source$.next(2);
      source$.next(3);
      expect(onBacklog.mock.calls).toEqual([[true]]);

      inners[0].complete();
      expect(onBacklog.mock.calls).toEqual([[true]]);
    });
  });

  describe('completion (node 4)', () => {
    it('does not complete before the source completed: 4c1(F)', () => {
      const source$ = new Subject<number>();
      const complete = vi.fn();

      source$
        .pipe(mergeMapBounded(() => EMPTY, 1))
        .subscribe({ complete });

      source$.next(0);
      expect(complete).not.toHaveBeenCalled();
    });

    it('does not complete while a value still waits: 4c1(T), 4c2(F)', () => {
      const source$ = new Subject<number>();
      const inners: Subject<never>[] = [];
      const complete = vi.fn();

      source$
        .pipe(
          mergeMapBounded(
            value => (inners[value] = new Subject<never>()),
            1,
          ),
        )
        .subscribe({ complete });

      source$.next(0);
      source$.next(1);
      source$.complete();

      expect(complete).not.toHaveBeenCalled();
      inners[0].complete();
      expect(complete).not.toHaveBeenCalled();
      inners[1].complete();
      expect(complete).toHaveBeenCalledTimes(1);
    });

    it('does not complete while an inner observable is active: 4c1(T), 4c2(T), 4c3(F)', () => {
      const source$ = new Subject<number>();
      const inner$ = new Subject<never>();
      const complete = vi.fn();

      source$
        .pipe(mergeMapBounded(() => inner$, 1))
        .subscribe({ complete });

      source$.next(0);
      source$.complete();
      expect(complete).not.toHaveBeenCalled();

      inner$.complete();
      expect(complete).toHaveBeenCalledTimes(1);
    });

    it('completes when source completed, no value waits and no inner is active: 4c3(T)', () => {
      const complete = vi.fn();

      of(1)
        .pipe(mergeMapBounded(() => EMPTY, 1))
        .subscribe({ complete });

      expect(complete).toHaveBeenCalledTimes(1);
    });
  });

  describe('queue links (node 5) and errors', () => {
    it('links a waiting value to the tail only when one waits: 5(T) and 5(F)', () => {
      const source$ = new Subject<number>();
      const blocker$ = new Subject<number>();
      const project = vi.fn((value: number) =>
        value === 0 ? blocker$ : of(value),
      );

      const received: number[] = [];
      source$
        .pipe(mergeMapBounded(project, 1))
        .subscribe(value => received.push(value));

      source$.next(0); // head === undefined -> head = waiting (5(F))
      source$.next(1); // head !== undefined -> tail.next = waiting (5(T))
      source$.next(2); // head !== undefined -> tail.next = waiting (5(T))

      blocker$.complete();
      expect(received).toEqual([1, 2]);
    });

    it('errors when project throws', () => {
      const error = new Error('project blew up');
      const onError = vi.fn();

      of(1)
        .pipe(
          mergeMapBounded(() => {
            throw error;
          }, 1),
        )
        .subscribe({ error: onError });

      expect(onError).toHaveBeenCalledWith(error);
    });

    it('forwards source errors', () => {
      const error = new Error('source blew up');
      const onError = vi.fn();

      throwError(() => error)
        .pipe(mergeMapBounded(() => EMPTY, 1))
        .subscribe({ error: onError });

      expect(onError).toHaveBeenCalledWith(error);
    });
  });
});
