import { useEffect, useState, useRef } from 'react'

interface ScanProgress {
  running: boolean
  progress: number
  total: number
  current_file: string
}

export function useScanProgress(onComplete?: () => void) {
  const [progress, setProgress] = useState<ScanProgress>({
    running: false, progress: 0, total: 0, current_file: ''
  })
  const wasRunningRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    const poll = () => {
      fetch('/api/scan/status')
        .then(r => r.json())
        .then((data: ScanProgress) => {
          if (!mountedRef.current) return
          setProgress(data)
          if (wasRunningRef.current && !data.running) {
            onCompleteRef.current?.()
          }
          wasRunningRef.current = data.running
        })
        .catch(() => {})
    }

    poll()
    timerRef.current = setInterval(poll, 2000)

    return () => {
      mountedRef.current = false
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  return progress
}
