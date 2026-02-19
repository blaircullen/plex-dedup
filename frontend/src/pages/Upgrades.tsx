import { useEffect, useState, useCallback } from 'react'

interface QueueItem {
  id: number
  track_id: number
  search_query: string
  status: string
  match_type: string | null
  created_at: string
  artist: string
  title: string
  album: string
  format: string
  bitrate: number
}

type FilterTab = 'all' | 'pending' | 'approved' | 'completed' | 'skipped'

const MATCH_BADGE: Record<string, string> = {
  exact: 'bg-emerald-900/50 text-emerald-400 border border-emerald-800',
  fuzzy: 'bg-amber-900/50 text-amber-400 border border-amber-800',
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-zinc-800 text-zinc-400 border border-zinc-700',
  approved: 'bg-blue-900/50 text-blue-400 border border-blue-800',
  downloading: 'bg-amber-900/50 text-amber-400 border border-amber-800',
  completed: 'bg-emerald-900/50 text-emerald-400 border border-emerald-800',
  failed: 'bg-red-900/50 text-red-400 border border-red-800',
  skipped: 'bg-zinc-800 text-zinc-500 border border-zinc-700',
}

function matchBadgeClass(matchType: string | null): string {
  if (!matchType) return 'bg-zinc-800 text-zinc-500 border border-zinc-700'
  return MATCH_BADGE[matchType] ?? 'bg-zinc-800 text-zinc-500 border border-zinc-700'
}

function statusBadgeClass(status: string): string {
  return STATUS_BADGE[status] ?? 'bg-zinc-800 text-zinc-500 border border-zinc-700'
}

export default function Upgrades() {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [actionInProgress, setActionInProgress] = useState<Set<number>>(new Set())
  const [bulkApproving, setBulkApproving] = useState(false)

  const fetchQueue = useCallback(async () => {
    setLoading(true)
    try {
      const params = filterTab === 'all' ? '' : `?status=${filterTab}`
      const res = await fetch(`/api/upgrades/queue${params}`)
      const data: QueueItem[] = await res.json()
      setQueue(data)
    } catch {
      setQueue([])
    } finally {
      setLoading(false)
    }
  }, [filterTab])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  const handleScan = async () => {
    setScanning(true)
    try {
      await fetch('/api/upgrades/scan', { method: 'POST' })
      await fetchQueue()
    } finally {
      setScanning(false)
    }
  }

  const handleApprove = async (id: number) => {
    setActionInProgress(prev => new Set(prev).add(id))
    try {
      await fetch(`/api/upgrades/queue/${id}/approve`, { method: 'POST' })
      setQueue(prev => prev.map(item =>
        item.id === id ? { ...item, status: 'approved' } : item
      ))
    } finally {
      setActionInProgress(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleSkip = async (id: number) => {
    setActionInProgress(prev => new Set(prev).add(id))
    try {
      await fetch(`/api/upgrades/queue/${id}/skip`, { method: 'POST' })
      setQueue(prev => prev.map(item =>
        item.id === id ? { ...item, status: 'skipped' } : item
      ))
    } finally {
      setActionInProgress(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleApproveAllExact = async () => {
    const exactPending = queue.filter(
      item => item.match_type === 'exact' && item.status === 'pending'
    )
    if (exactPending.length === 0) return
    setBulkApproving(true)
    try {
      await Promise.all(
        exactPending.map(item =>
          fetch(`/api/upgrades/queue/${item.id}/approve`, { method: 'POST' })
        )
      )
      setQueue(prev => prev.map(item =>
        item.match_type === 'exact' && item.status === 'pending'
          ? { ...item, status: 'approved' }
          : item
      ))
    } finally {
      setBulkApproving(false)
    }
  }

  const totalCandidates = queue.length
  const exactMatches = queue.filter(i => i.match_type === 'exact').length
  const approvedCount = queue.filter(i => i.status === 'approved').length
  const exactPendingCount = queue.filter(
    i => i.match_type === 'exact' && i.status === 'pending'
  ).length

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'completed', label: 'Completed' },
    { key: 'skipped', label: 'Skipped' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Upgrades</h2>
        <div className="flex gap-3">
          {exactPendingCount > 0 && (
            <button
              onClick={handleApproveAllExact}
              disabled={bulkApproving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg text-sm font-medium transition-colors"
            >
              {bulkApproving
                ? 'Approving...'
                : `Approve All Exact (${exactPendingCount})`}
            </button>
          )}
          <button
            onClick={handleScan}
            disabled={scanning}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg text-sm font-medium transition-colors"
          >
            {scanning ? 'Scanning...' : 'Find Upgrades'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          ['Candidates', totalCandidates.toLocaleString()],
          ['Exact Matches', exactMatches.toLocaleString()],
          ['Approved', approvedCount.toLocaleString()],
        ].map(([label, value]) => (
          <div
            key={label}
            className="bg-zinc-900 rounded-xl p-5 border border-zinc-800"
          >
            <div className="text-sm text-zinc-500 mb-1">{label}</div>
            <div className="text-2xl font-bold">{value}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilterTab(tab.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filterTab === tab.key
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-zinc-500">Loading...</div>
      ) : queue.length === 0 ? (
        <div className="text-zinc-500">
          No upgrade candidates found. Click Find Upgrades to scan your library.
        </div>
      ) : (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 text-left">
                  <th className="px-4 py-3 font-medium">Artist</th>
                  <th className="px-4 py-3 font-medium">Album</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Format</th>
                  <th className="px-4 py-3 font-medium">Bitrate</th>
                  <th className="px-4 py-3 font-medium text-center">Match</th>
                  <th className="px-4 py-3 font-medium text-center">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.map(item => {
                  const busy = actionInProgress.has(item.id)
                  const canAct = item.status === 'pending'
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="px-4 py-3">{item.artist || '--'}</td>
                      <td className="px-4 py-3 text-zinc-400">
                        {item.album || '--'}
                      </td>
                      <td className="px-4 py-3">{item.title || '--'}</td>
                      <td className="px-4 py-3 uppercase font-mono">
                        {item.format}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {item.bitrate > 0 ? `${item.bitrate} kbps` : '--'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${matchBadgeClass(item.match_type)}`}
                        >
                          {item.match_type ?? 'pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusBadgeClass(item.status)}`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canAct && (
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleApprove(item.id)}
                              disabled={busy}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 rounded text-xs font-medium transition-colors"
                            >
                              {busy ? '...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => handleSkip(item.id)}
                              disabled={busy}
                              className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-600 rounded text-xs font-medium transition-colors"
                            >
                              {busy ? '...' : 'Skip'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
