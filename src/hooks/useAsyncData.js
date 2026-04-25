import { useCallback, useEffect, useMemo, useState } from "react";

const asyncDataCache = new Map();

function getCacheKey(fetcher, deps) {
  const depsKey = JSON.stringify(deps || []);
  return `${fetcher.name || "anonymous-fetcher"}:${depsKey}`;
}

export function useAsyncData(fetcher, deps = []) {
  const cacheKey = useMemo(() => getCacheKey(fetcher, deps), [fetcher, deps]);
  const cachedRows = asyncDataCache.get(cacheKey);
  const [rows, setRowsState] = useState(() => cachedRows ?? []);
  const [loading, setLoading] = useState(() => cachedRows === undefined);
  const [error, setError] = useState("");

  const setRows = useCallback(
    (value) => {
      setRowsState((previousRows) => {
        const nextRows = typeof value === "function" ? value(previousRows) : value;
        asyncDataCache.set(cacheKey, nextRows);
        return nextRows;
      });
    },
    [cacheKey],
  );

  const reload = useCallback(async () => {
    try {
      setError("");
      setLoading(true);
      const data = await fetcher();
      setRows(data);
    } catch (err) {
      setError(err.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [fetcher, setRows]);

  useEffect(() => {
    let mounted = true;
    async function run() {
      try {
        setError("");
        const hasCachedData = asyncDataCache.has(cacheKey);
        if (!hasCachedData) {
          setLoading(true);
        }
        const data = await fetcher();
        if (mounted) setRows(data);
      } catch (err) {
        if (mounted) setError(err.message || "Gagal memuat data");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    run();
    return () => {
      mounted = false;
    };
  }, [cacheKey, fetcher, setRows, ...deps]);

  return { rows, loading, error, reload, setRows };
}
