import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { useScanProgress } from './useScanProgress'

interface ScanState {
  running: boolean
  progress: number
  total: number
  current_file: string
  phase: string
  started_at: number | null
  stale_removed: number
  error: boolean
  scanRequested: boolean
  requestScan: () => Promise<void>
}

const ScanContext = createContext<ScanState | null>(null)

export function ScanProvider({ children, onComplete }: { children: ReactNode; onComplete?: () => void }) {
  const [scanRequested, setScanRequested] = useState(false)

  const progress = useScanProgress(() => {
    setScanRequested(false)
    onComplete?.()
  })

  useEffect(() => {
    if (progress.running) setScanRequested(false)
  }, [progress.running])

  const requestScan = async () => {
    setScanRequested(true)
    try {
      await fetch('/api/scan/start', { method: 'POST' })
    } catch {
      setScanRequested(false)
      throw new Error('Failed to start scan')
    }
  }

  return (
    <ScanContext.Provider value={{
      ...progress,
      running: progress.running || scanRequested,
      scanRequested,
      requestScan,
    }}>
      {children}
    </ScanContext.Provider>
  )
}

export function useScan() {
  const ctx = useContext(ScanContext)
  if (!ctx) throw new Error('useScan must be used within ScanProvider')
  return ctx
}
