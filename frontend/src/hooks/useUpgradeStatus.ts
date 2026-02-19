import { useState, useEffect, useRef } from 'react'

interface UpgradeStatus {
  running: boolean
  current_query: string
  progress: number
  total: number
}

export function useUpgradeStatus(enabled: boolean) {
  const [status, setStatus] = useState<UpgradeStatus>({
    running: false, current_query: '', progress: 0, total: 0,
  })
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }

    const poll = () => {
      fetch('/api/upgrades/status')
        .then(r => r.json())
        .then((data: UpgradeStatus) => {
          setStatus(data)
          if (!data.running && timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
        })
        .catch(() => {})
    }

    poll()
    timerRef.current = setInterval(poll, 2000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [enabled])

  return status
}
