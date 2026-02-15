import { useState, useEffect, useRef, useCallback } from 'react'

interface CacheEntry<T> {
  data: T
  timestamp: number
}

// Global cache store shared across all hook instances
const globalCache = new Map<string, CacheEntry<unknown>>()

const DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

function getCached<T>(key: string, ttl: number): T | null {
  const cached = globalCache.get(key) as CacheEntry<T> | undefined
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data
  }
  return null
}

interface UseCachedApiOptions {
  /** Cache TTL in milliseconds (default: 5 minutes) */
  ttl?: number
  /** Whether to skip the fetch entirely */
  skip?: boolean
}

interface UseCachedApiResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  retry: () => void
  invalidate: () => void
}

/**
 * API fetching hook with built-in caching.
 * Caches responses by key and serves stale data while revalidating.
 */
export function useCachedApi<T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: UseCachedApiOptions = {},
): UseCachedApiResult<T> {
  const { ttl = DEFAULT_TTL, skip = false } = options

  const [data, setData] = useState<T | null>(() => getCached<T>(key, ttl))
  const [loading, setLoading] = useState<boolean>(!getCached<T>(key, ttl) && !skip)
  const [error, setError] = useState<string | null>(null)
  const fetchIdRef = useRef(0)

  useEffect(() => {
    if (skip) return

    // Check cache first — return early without fetching
    const cached = getCached<T>(key, ttl)
    if (cached) {
      setData(cached)
      setLoading(false)
      setError(null)
      return
    }

    const fetchId = ++fetchIdRef.current
    const controller = new AbortController()

    setLoading(true)
    setError(null)

    fetcher(controller.signal)
      .then((result) => {
        if (fetchId !== fetchIdRef.current) return
        globalCache.set(key, { data: result, timestamp: Date.now() })
        setData(result)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        if (fetchId !== fetchIdRef.current) return
        const message = err instanceof Error ? err.message : 'שגיאה בלתי צפויה'
        setError(message)
        setLoading(false)
      })

    return () => controller.abort()
  }, [key, fetcher, ttl, skip])

  const retry = useCallback(() => {
    globalCache.delete(key)
    fetchIdRef.current++
    // Force a re-render by setting loading
    setLoading(true)
    setError(null)

    const controller = new AbortController()
    const fetchId = fetchIdRef.current

    fetcher(controller.signal)
      .then((result) => {
        if (fetchId !== fetchIdRef.current) return
        globalCache.set(key, { data: result, timestamp: Date.now() })
        setData(result)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        if (fetchId !== fetchIdRef.current) return
        const message = err instanceof Error ? err.message : 'שגיאה בלתי צפויה'
        setError(message)
        setLoading(false)
      })
  }, [key, fetcher])

  const invalidate = useCallback(() => {
    globalCache.delete(key)
  }, [key])

  return { data, loading, error, retry, invalidate }
}

/**
 * Invalidate all cached entries matching a prefix.
 */
export function invalidateCache(prefix?: string) {
  if (!prefix) {
    globalCache.clear()
    return
  }
  for (const cacheKey of globalCache.keys()) {
    if (cacheKey.startsWith(prefix)) {
      globalCache.delete(cacheKey)
    }
  }
}
