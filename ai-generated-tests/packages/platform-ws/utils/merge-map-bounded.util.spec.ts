import {
  EMPTY,
  from,
  lastValueFrom,
  of,
  Subject,
  Subscription,
  throwError,
  toArray,
} from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { mergeMapBounded } from '../../../../packages/platform-ws/utils/merge-map-bounded.util.js';

/**
 * C3 analysis for `mergeMapBounded` — decision nodes after splitting the
 * atomic conditions (short-circuit respected):
 *
 * 1  `if (isDraining)`                                    -> 1(T) / 1(F)
 * 2  `while (head && active < concurrent && !closed)`     -> 2c1(T/F) 2c2(T/F) 2c3(T/F)
 * 3  `if (onBacklog && isBacklogged !== !!head)`          -> 3c1(T/F) 3c2(T/F)
 * 4  `if (isSourceComplete && !head && active === 0)`     -> 4c1(T/F) 4c2(T/F) 4c3(T/F)
 * 5  `tail = head ? (tail.next = waiting) : (head = waiting)` -> 5(T) / 5(F)
 *
 * Independent paths = 5 decision nodes + 1 = 6 (paths below are combined so
 * that every atomic condition is evaluated True and False at least once).
 */
describe('mergeMapBounded (C3)', () => {
  describe('node 1 - re-entrant drain', () => {
    it.each([
      ['concurrent = 1', 1],
      ['concurrent = 2', 2],
      ['concurrent = Infinity', Infinity],
    ])(
      're-enters drain when an inner observable completes synchronously (%s): 1(T) and 1(F)',
      async (_label, concurrent) => {
        const result = await lastValueFrom(
          from([1, 2, 3]).pipe(
            mergeMapBounded(value => of(value, value * 10), concurrent),
            toArray(),
          ),
        );

        // every inner completes inside the drain loop, so complete() re-enters
        // drain while isDraining === true (1(T)); the outer call is 1(F)
        expect(result).toEqual([1, 10, 2, 20, 3, 30]);
      },
    );

    it('does not start anything for an empty source: 2c1(F)', () => {
      const project = vi.fn(() => EMPTY);
      const onComplete = vi.fn();

      EMPTY.pipe(mergeMapBounded(project, 1)).subscribe({
        complete: onComplete,
      });

      expect(project).not.toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe('node 2 - bounded drain loop', () => {
    it('keeps at most "concurrent" inner observables active: 2c1(T), 2c2(T), 2c2(F)', () => {
      const source$ = new Subject<number>();
      const inners: Subject<string>[] = [];
      const started: number[] = [];

      source$
        .pipe(
          mergeMapBounded(value => {
            started.push(value);
            return (inners[value] = new Subject<string>());
          }, 2),
        )
        .subscribe();

      [0, 1, 2, 3].forEach(value => source$.next(value));
      // two started (2c2 T while active < 2), two wait (2c2 F)
      expect(started).toEqual([0, 1]);

      inners[1].complete();
      expect(started).toEqual([0, 1, 2]);

      inners[0].complete();
      expect(started).toEqual([0, 1, 2, 3]);
    });

    it('stops the loop once the subscriber is closed: 2c1(T), 2c3(T) then 2c3(F)', () => {
      const source$ = new Subject<number>();
      let subscription: Subscription | undefined;
      let calls = 0;

      subscription = source$
        .pipe(
          mergeMapBounded(() => {
            calls++;
            subscription!.unsubscribe();
            return EMPTY;
          }, 1),
        )
        .subscribe();

      source$.next(0);

      expect(calls).toBe(1);
      expect(subscription!.closed).toBe(true);
    });
  });

  describe('node 3 - backlog notification', () => {
    it('skips the notification when no callback is given: 3c1(F)', () => {
      const source$ = new Subject<number>();
      const project = vi.fn(() => new Subject<never>());

      source$.pipe(mergeMapBounded(project, 1)).subscribe();
      source$.next(0);
      source$.next(1);

      expect(project).toHaveBeenCalledTimes(1);
    });

    it('reports only transitions between waiting and idle: 3c1(T), 3c2(F), 3c2(T)', () => {
      const source$ = new Subject<number>();
      const inners: Subject<never>[] = [];
      const onBacklog = vi.fn();

      source$
        .pipe(
          mergeMapBounded(
            value => (inners[value] = new Subject<never>()),
            1,
            onBacklog,
          ),
        )
        .subscribe();

      // value starts immediately: head === undefined and isBacklogged === false
      source$.next(0);
      expect(onBacklog).not.toHaveBeenCalled(); // 3c2(F)

      source$.next(1);
      expect(onBacklog.mock.calls).toEqual([[true]]); // 3c2(T)

      // active inner completes, the waiting value starts, nothing waits anymore
      inners[0].complete();
      expect(onBacklog.mock.calls).toEqual([[true], [false]]); // 3c2(T)

      // idle, so no further transition is reported
      inners[1].complete();
      expect(onBacklog.mock.calls).toEqual([[true], [false]]); // 3c2(F)
    });

    it('does not repeat an already reported backlog: 3c2(F) with head set', () => {
      const source$ = new Subject<number>();
      const inners: Subject<never>[] = [];
      const onBacklog = vi.fn();

      source$
        .pipe(
          mergeMapBounded(
            value => (inners[value] = new Subject<never>()),
            1,
            onBacklog,
          ),
        )
        .subscribe();

      source$.next(0);
      source$.next(1);
      source$.next(2);
      expect(onBacklog.mock.calls).toEqual([[true]]);

      inners[0].complete();
      // a value still waits: isBacklogged === true and true !== true is false
      expect(onBacklog.mock.calls).toEqual([[true]]);

      inners[1].complete();
      expect(onBacklog.mock.calls).toEqual([[true], [false]]);
    });
  });

  describe('node 4 - completion', () => {
    it('does not complete before the source completed: 4c1(F)', () => {
      const source$ = new Subject<number>();
      const onComplete = vi.fn();

      source$.pipe(mergeMapBounded(() => EMPTY, 1)).subscribe({
        complete: onComplete,
      });

      source$.next(0);
      expect(onComplete).not.toHaveBeenCalled();
    });

    it('does not complete while a value still waits: 4c1(T), 4c2(F)', () => {
      const source$ = new Subject<number>();
      const inners: Subject<never>[] = [];
      const onComplete = vi.fn();

      source$
        .pipe(
          mergeMapBounded(value => (inners[value] = new Subject<never>()), 1),
        )
        .subscribe({ complete: onComplete });

      source$.next(0);
      source$.next(1);
      source$.complete();

      expect(onComplete).not.toHaveBeenCalled();
      inners[0].complete();
      expect(onComplete).not.toHaveBeenCalled();
      inners[1].complete();
      expect(onComplete).toHaveBeenCalledTimes(1); // 4c3(T)
    });

    it('does not complete while an inner observable is active: 4c1(T), 4c2(T), 4c3(F)', () => {
      const source$ = new Subject<number>();
      const inner$ = new Subject<never>();
      const onComplete = vi.fn();

      source$.pipe(mergeMapBounded(() => inner$, 1)).subscribe({
        complete: onComplete,
      });

      source$.next(0);
      source$.complete();
      expect(onComplete).not.toHaveBeenCalled();

      inner$.complete();
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('completes when the source is complete, nothing waits and nothing is active: 4c3(T)', () => {
      const onComplete = vi.fn();

      of(1)
        .pipe(mergeMapBounded(() => EMPTY, 1))
        .subscribe({ complete: onComplete });

      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe('node 5 - waiting queue links and errors', () => {
    it('links a waiting value to the tail only when one already waits: 5(F) then 5(T)', () => {
      const source$ = new Subject<number>();
      const blocker$ = new Subject<number>();
      const received: number[] = [];

      source$
        .pipe(mergeMapBounded(value => (value === 0 ? blocker$ : of(value)), 1))
        .subscribe(value => received.push(value));

      source$.next(0); // head === undefined -> head = waiting       (5 F)
      source$.next(1); // tail is set -> tail.next = waiting         (5 T)
      source$.next(2); // tail is set -> tail.next = waiting         (5 T)

      blocker$.complete();
      expect(received).toEqual([1, 2]);
    });

    it('forwards errors thrown by "project"', () => {
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

    it('drops the waiting values and active inners on unsubscribe', () => {
      const source$ = new Subject<number>();
      const inner$ = new Subject<number>();
      const project = vi.fn(() => inner$);

      const subscription = source$
        .pipe(mergeMapBounded(project, 1))
        .subscribe();
      source$.next(0);
      source$.next(1);
      subscription.unsubscribe();

      expect(source$.observed).toBe(false);
      expect(inner$.observed).toBe(false);
      inner$.complete();
      expect(project).toHaveBeenCalledTimes(1);
    });
  });
});
