import { useCallback, useEffect, useRef, useState } from 'react';

import type { PagedResult, ProductSummary } from '../api/types';

export interface PagedProductsState {
  products: ProductSummary[];
  totalCount: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  loadMore: () => void;
  reload: () => void;
}

/**
 * Infinite-scroll pagination over a paged product endpoint.
 * Pass `fetchPage = null` to stay idle (e.g. empty search query).
 */
export function usePagedProducts(fetchPage: ((page: number) => Promise<PagedResult<ProductSummary>>) | null): PagedProductsState {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);

  const load = useCallback(
    async (pageIndex: number) => {
      if (!fetchPage) return;
      const current = generation.current;
      if (pageIndex === 0) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const result = await fetchPage(pageIndex);
        if (current !== generation.current) return;
        setProducts((existing) => (pageIndex === 0 ? result.items : [...existing, ...result.items]));
        setTotalCount(result.totalCount);
        setHasNextPage(result.hasNextPage);
        setPage(pageIndex);
      } catch (e) {
        if (current === generation.current) setError((e as Error).message);
      } finally {
        if (current === generation.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [fetchPage],
  );

  const reload = useCallback(() => {
    generation.current += 1;
    setProducts([]);
    setTotalCount(0);
    setHasNextPage(false);
    load(0);
  }, [load]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  const loadMore = useCallback(() => {
    if (hasNextPage && !loading && !loadingMore) load(page + 1);
  }, [hasNextPage, loading, loadingMore, load, page]);

  return { products, totalCount, loading, loadingMore, error, loadMore, reload };
}
