import { useEffect, useState, useRef } from 'react'

interface ScanProgress {
  running: boolean
  progress: number
  total: number
  current_file: string
  phase: string
  started_at: number | null
  stale_removed: number
}

export function useScanProgress(onComplete?: () => void) {
  const [progress, setProgress] = useState<ScanProgress>({
    running: false, progress: 0, total: 0, current_file: '',
    phase: 'idle', started_at: null, stale_removed: 0,
  })
  const [error, setError] = useState(false)
  const wasRunningRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)
  const errorCountRef = useRef(0)

  useEffect(() => {
    mountedRef.current = true

    const poll = () => {
      fetch('/api/scan/status')
        .then(r => r.json())
        .then((data: ScanProgress) => {
          if (!mountedRef.current) return
          errorCountRef.current = 0
          setError(false)
          setProgress(data)
          if (wasRunningRef.current && !data.running) {
            onCompleteRef.current?.()
          }
          wasRunningRef.current = data.running
        })
        .catch(() => {
          if (!mountedRef.current) return
          errorCountRef.current++
          if (errorCountRef.current >= 3) {
            setError(true)
          }
        })
    }

    poll()
    timerRef.current = setInterval(poll, 2000)

    return () => {
      mountedRef.current = false
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  return { ...progress, error }
}
