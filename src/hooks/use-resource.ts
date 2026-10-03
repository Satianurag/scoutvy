import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
export function useResource<T>(key: string, fetcher: () => Promise<T>) {
  const [result, setResult] = useState<{ key: string; data: T } | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++latest.current;
    setLoading(true);
    setError(false);
    try {
      const data = await fetcher();
      if (id === latest.current) setResult({ key, data });
    } catch {
      if (id === latest.current) setError(true);
    } finally {
      if (id === latest.current) setLoading(false);
    }
  }, [key, fetcher]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
      return () => {
        latest.current++;
      };
    }, [refresh]),
  );
  return { data: result?.key === key ? result.data : null, error, loading, refresh };
}
