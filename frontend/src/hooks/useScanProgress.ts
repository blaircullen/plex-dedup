import { useEffect, useState, useRef, useCallback } from 'react'

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
  const wsRef = useRef<WebSocket | null>(null)
  const wasRunningRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const handleMessage = useCallback((data: ScanProgress) => {
    setProgress(data)
    if (wasRunningRef.current && !data.running) {
      onCompleteRef.current?.()
    }
    wasRunningRef.current = data.running
  }, [])

  useEffect(() => {
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/scan/ws`)
      wsRef.current = ws

      ws.onmessage = (e) => {
        try {
          handleMessage(JSON.parse(e.data))
        } catch { /* ignore parse errors */ }
      }

      ws.onclose = () => {
        setTimeout(connect, 3000)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    fetch('/api/scan/status')
      .then(r => r.json())
      .then((data: ScanProgress) => {
        setProgress(data)
        wasRunningRef.current = data.running
      })
      .catch(() => {})

    connect()

    return () => {
      wsRef.current?.close()
    }
  }, [handleMessage])

  return progress
}
