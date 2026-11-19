import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { PagedResult, ProductSummary } from '../../src/api/types';
import { useAsync } from '../../src/hooks/useAsync';
import { usePagedProducts } from '../../src/hooks/usePagedProducts';
import { paged, productSummary } from '../fixtures';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe('useAsync', () => {
  it('loads data and reloads on demand', async () => {
    const loader = jest.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');
    const { result } = await renderHook(() => useAsync(loader));

    await waitFor(() => expect(result.current.data).toBe('first'));
    expect(result.current.loading).toBe(false);

    await act(() => result.current.reload());
    expect(result.current.data).toBe('second');
  });

  it('exposes errors', async () => {
    const loader = jest.fn().mockRejectedValue(new Error('boom'));
    const { result } = await renderHook(() => useAsync(loader));
    await waitFor(() => expect(result.current.error).toBe('boom'));
    expect(result.current.data).toBeNull();
  });

  it('ignores results of superseded loads', async () => {
    const slow = deferred<string>();
    const first = jest.fn(() => slow.promise);
    const second = jest.fn(async () => 'fresh');
    const { result, rerender } = await renderHook(({ loader }: { loader: () => Promise<string> }) => useAsync(loader), { initialProps: { loader: first } });

    await rerender({ loader: second });
    await waitFor(() => expect(result.current.data).toBe('fresh'));
    await act(async () => slow.resolve('stale'));
    expect(result.current.data).toBe('fresh');
  });
});

describe('usePagedProducts', () => {
  it('stays idle without a fetcher', async () => {
    const { result } = await renderHook(() => usePagedProducts(null));
    expect(result.current).toMatchObject({ products: [], loading: false, totalCount: 0 });
  });

  it('loads the first page and appends further pages', async () => {
    const fetchPage = jest.fn(async (page: number) =>
      page === 0 ? paged([productSummary(1), productSummary(2)], 0, 3, true) : paged([productSummary(3)], 1, 3, false),
    );
    const { result } = await renderHook(() => usePagedProducts(fetchPage));

    await waitFor(() => expect(result.current.products).toHaveLength(2));
    expect(result.current.totalCount).toBe(3);

    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.products.map((p) => p.id)).toEqual([1, 2, 3]));

    await act(async () => result.current.loadMore());
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('reports errors and recovers on reload', async () => {
    const fetchPage = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(paged([productSummary(1)]));
    const { result } = await renderHook(() => usePagedProducts(fetchPage));

    await waitFor(() => expect(result.current.error).toBe('offline'));
    await act(async () => result.current.reload());
    await waitFor(() => expect(result.current.products).toHaveLength(1));
    expect(result.current.error).toBeNull();
  });

  it('discards pages from a previous fetcher', async () => {
    const slow = deferred<ReturnType<typeof paged>>();
    const first = jest.fn(() => slow.promise);
    const second = jest.fn(async () => paged([productSummary(9)]));
    const { result, rerender } = await renderHook(({ fetchPage }: { fetchPage: (page: number) => Promise<PagedResult<ProductSummary>> }) => usePagedProducts(fetchPage), {
      initialProps: { fetchPage: first },
    });

    await rerender({ fetchPage: second });
    await waitFor(() => expect(result.current.products.map((p) => p.id)).toEqual([9]));
    await act(async () => slow.resolve(paged([productSummary(1)])));
    expect(result.current.products.map((p) => p.id)).toEqual([9]);
  });
});
