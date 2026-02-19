import { useEffect, useState, useRef } from 'react'

interface ScanProgress {
  running: boolean
  progress: number
  total: number
  current_file: string
}

export function useScanProgress() {
  const [progress, setProgress] = useState<ScanProgress>({
    running: false, progress: 0, total: 0, current_file: ''
  })
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/scan/ws`)
      wsRef.current = ws

      ws.onmessage = (e) => {
        try {
          setProgress(JSON.parse(e.data))
        } catch {}
      }

      ws.onclose = () => {
        setTimeout(connect, 3000)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    // Fetch initial status
    fetch('/api/scan/status')
      .then(r => r.json())
      .then(setProgress)
      .catch(() => {})

    connect()

    return () => {
      wsRef.current?.close()
    }
  }, [])

  return progress
}
