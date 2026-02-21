import { useScan } from '../../hooks/ScanContext'
import { useUpgradeStatus } from '../../hooks/useUpgradeStatus'
import { Loader2, CheckCircle, Download, Search, AlertTriangle } from 'lucide-react'

const SCAN_PHASE_LABELS: Record<string, string> = {
  counting: 'Counting files...',
  scanning: 'Scanning',
  cleaning: 'Cleaning stale records...',
  analyzing: 'Analyzing duplicates...',
}

export function ActivityPanel() {
  const scan = useScan()
  const { status: upgrade } = useUpgradeStatus()

  if (scan.error) {
    return (
      <div className="flex items-center gap-2 text-xs text-red-400">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>Backend unreachable</span>
      </div>
    )
  }

  if (scan.running) {
    const phaseLabel = SCAN_PHASE_LABELS[scan.phase] ?? 'Working...'
    return (
      <div className="flex items-center gap-2 text-xs text-lime">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>
          {scan.phase === 'scanning' && scan.total > 0
            ? `Scanning: ${scan.progress.toLocaleString()}/${scan.total.toLocaleString()}`
            : phaseLabel
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
