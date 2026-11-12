import {
  Observable,
  of,
  Subject,
  throwError,
  firstValueFrom,
  toArray,
} from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { mergeMapBounded } from '../../../../packages/websockets/utils/merge-map-bounded.util.js';

const collect = <T>(source: Observable<T>) =>
  firstValueFrom(source.pipe(toArray()));

describe('mergeMapBounded', () => {
  it('should project every value and emit all results', async () => {
    const result = await collect(
      of(1, 2, 3, 4, 5).pipe(mergeMapBounded(value => of(value * 2), 2)),
    );

    expect(result).toEqual([2, 4, 6, 8, 10]);
  });

  it('should respect the concurrency limit', async () => {
    let active = 0;
    let maxActive = 0;
    const result = await collect(
      of(1, 2, 3, 4).pipe(
        mergeMapBounded(
          value =>
            new Observable<number>(subscriber => {
              active++;
              maxActive = Math.max(maxActive, active);
              setTimeout(() => {
                active--;
                subscriber.next(value);
                subscriber.complete();
              }, 1);
            }),
          2,
        ),
      ),
    );

    expect(result).toEqual([1, 2, 3, 4]);
    expect(maxActive).toBe(2);
  });

  it('should report when values start and stop waiting', async () => {
    const backlog: boolean[] = [];
    await collect(
      of(1, 2, 3).pipe(
        mergeMapBounded(
          value =>
            new Observable<number>(subscriber => {
              setTimeout(() => {
                subscriber.next(value);
                subscriber.complete();
              }, 1);
            }),
          1,
          isBacklogged => backlog.push(isBacklogged),
        ),
      ),
    );

    expect(backlog).toEqual([true, false]);
  });

  it('should complete when the source completes with no work left', async () => {
    const completed = vi.fn();
    of().pipe(mergeMapBounded(value => of(value), 2)).subscribe({
      complete: completed,
    });

    expect(completed).toHaveBeenCalledOnce();
  });

  it('should propagate a source error', async () => {
    const error = new Error('source failed');
    await expect(
      firstValueFrom(
        throwError(() => error).pipe(mergeMapBounded(value => of(value), 2)),
      ),
    ).rejects.toBe(error);
  });

  it('should propagate a project error', async () => {
    const error = new Error('project failed');
    await expect(
      collect(of(1).pipe(mergeMapBounded(() => throwError(() => error), 1))),
    ).rejects.toBe(error);
  });

  it('should stop draining when the subscriber unsubscribes', async () => {
    const values: number[] = [];
    const subject = new Subject<number>();
    const project = vi.fn((value: number) => of(value));

    const subscription = subject
      .pipe(mergeMapBounded(project, 1))
      .subscribe(value => {
        values.push(value);
        subscription.unsubscribe();
      });

    subject.next(1);
    subject.next(2);

    expect(values).toEqual([1]);
    expect(project).toHaveBeenCalledTimes(1);
  });

  it('should handle synchronous inner completion without losing values', async () => {
    const result = await collect(
      of(1, 2, 3).pipe(mergeMapBounded(value => of(value), 10)),
    );

    expect(result).toEqual([1, 2, 3]);
  });
});
