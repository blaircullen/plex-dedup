import { useScan } from '../../hooks/ScanContext'
import { Loader2, CheckCircle } from 'lucide-react'

export function ActivityPanel() {
  const { running, progress, total } = useScan()

  if (!running) {
    return (
      <div className="flex items-center gap-2 text-xs text-base-500">
        <CheckCircle className="w-3.5 h-3.5" />
        <span>System idle</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-xs text-lime">
      <Loader2 className="w-3.5 h-3.5 animate-spin" />
      <span>
        {total > 0
          ? `Scanning: ${progress.toLocaleString()}/${total.toLocaleString()}`
          : 'Scan starting...'
        }
      </span>
    </div>
  )
}
