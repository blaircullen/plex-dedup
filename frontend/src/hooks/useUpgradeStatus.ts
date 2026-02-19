import { useState, useEffect, useRef, useCallback } from 'react'

export interface UpgradeStatus {
  running: boolean
  phase: 'idle' | 'searching' | 'downloading'
  current: string
  progress: number
  total: number
}

const INITIAL: UpgradeStatus = {
  running: false, phase: 'idle', current: '', progress: 0, total: 0,
}

export function useUpgradeStatus() {
  const [status, setStatus] = useState<UpgradeStatus>(INITIAL)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)

  const poll = useCallback(() => {
    fetch('/api/upgrades/status')
      .then(r => r.json())
      .then((data: UpgradeStatus) => {
        if (mountedRef.current) setStatus(data)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    mountedRef.current = true
    poll()
    timerRef.current = setInterval(poll, 2000)

    return () => {
      mountedRef.current = false
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [poll])

  return { status, poll }
}
