import { useScan } from '../../hooks/ScanContext'
import { useUpgradeStatus } from '../../hooks/useUpgradeStatus'
import { Loader2, CheckCircle, Download, Search } from 'lucide-react'

export function ActivityPanel() {
  const scan = useScan()
  const { status: upgrade } = useUpgradeStatus()

  if (scan.running) {
    return (
      <div className="flex items-center gap-2 text-xs text-lime">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>
          {scan.total > 0
            ? `Scanning: ${scan.progress.toLocaleString()}/${scan.total.toLocaleString()}`
            : 'Scan starting...'
          }
        </span>
      </div>
    )
  }

  if (upgrade.phase === 'downloading') {
    return (
      <div className="flex items-center gap-2 text-xs text-lime">
        <Download className="w-3.5 h-3.5 animate-bounce" />
        <span>
          Downloading: {upgrade.progress}/{upgrade.total}
          {upgrade.current && ` — ${upgrade.current}`}
        </span>
      </div>
    )
  }

  if (upgrade.phase === 'searching') {
    return (
      <div className="flex items-center gap-2 text-xs text-lime">
        <Search className="w-3.5 h-3.5 animate-pulse" />
        <span>
          Searching: {upgrade.progress}/{upgrade.total}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-xs text-base-500">
      <CheckCircle className="w-3.5 h-3.5" />
      <span>System idle</span>
    </div>
  )
}
