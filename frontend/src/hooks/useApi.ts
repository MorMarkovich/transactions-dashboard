import { useState, useEffect, useRef, useCallback } from 'react'

interface UseApiResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  retry: () => void
  setData: React.Dispatch<React.SetStateAction<T | null>>
}

/**
 * Custom hook for data fetching with loading/error states,
 * automatic cleanup via AbortController, and a retry mechanism.
 *
 * @param fetcher - Async function that receives an AbortSignal and returns data.
 * @param deps    - Dependency array that triggers a re-fetch when changed.
 */
export function useApi<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: unknown[]
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const retryCountRef = useRef(0)

  const fetchData = useCallback(() => {
    const abortController = new AbortController()

    setLoading(true)
    setError(null)

    fetcher(abortController.signal)
      .then((result) => {
        if (!abortController.signal.aborted) {
          setData(result)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (abortController.signal.aborted) return

        const message =
          err instanceof Error ? err.message : 'שגיאה בלתי צפויה'
        setError(message)
        setLoading(false)
      })

    return abortController
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    const controller = fetchData()
    return () => controller.abort()
  }, [fetchData])

  const retry = useCallback(() => {
    retryCountRef.current += 1
    const controller = fetchData()
    // Clean up if component unmounts during retry
    return () => controller.abort()
  }, [fetchData])

  return { data, loading, error, retry, setData }
}
