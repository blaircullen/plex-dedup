import { useScanProgress } from '../../hooks/useScanProgress'
import { Loader2, CheckCircle } from 'lucide-react'

export function ActivityPanel() {
  const progress = useScanProgress()

  if (!progress.running) {
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
      <span>Scanning: {progress.progress.toLocaleString()}/{progress.total.toLocaleString()}</span>
    </div>
  )
}
