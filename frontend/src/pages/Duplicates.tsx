import { useEffect, useState, useCallback } from 'react'

interface Track {
  id: number
  file_path: string
  format: string
  bitrate: number
  bit_depth: number
  sample_rate: number
  file_size: number
  artist: string
  title: string
  album: string
}

interface DupeGroup {
  id: number
  match_type: string
  confidence: number
  resolved: number
  kept_track_id: number
  member_ids: string
}

interface DupeResult {
  group: DupeGroup
  members: Track[]
}

type SortKey = 'confidence' | 'quality_gap' | 'artist'
type SortDir = 'asc' | 'desc'
type FilterTab = 'all' | 'unresolved' | 'resolved'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function formatSampleRate(rate: number): string {
  return rate >= 1000 ? `${(rate / 1000).toFixed(1)} kHz` : `${rate} Hz`
}

function getQualityScore(track: Track): number {
  const formatScores: Record<string, number> = {
    flac: 100, alac: 95, wav: 90, aiff: 90,
    aac: 60, ogg: 55, mp3: 50, wma: 40,
  }
  const base = formatScores[track.format.toLowerCase()] ?? 30
  const bitrateBonus = track.bitrate > 0 ? Math.min(track.bitrate / 3200, 10) : 0
  const depthBonus = track.bit_depth > 16 ? (track.bit_depth - 16) * 2 : 0
  const sampleBonus = track.sample_rate > 44100 ? ((track.sample_rate - 44100) / 44100) * 5 : 0
  return base + bitrateBonus + depthBonus + sampleBonus
}

function getWinner(members: Track[]): Track {
  return members.reduce((best, t) => getQualityScore(t) > getQualityScore(best) ? t : best, members[0])
}

function getQualityGap(members: Track[]): number {
  const scores = members.map(getQualityScore)
  return Math.round(Math.max(...scores) - Math.min(...scores))
}

export default function Duplicates() {
  const [dupes, setDupes] = useState<DupeResult[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [resolving, setResolving] = useState<Set<number>>(new Set())
  const [bulkResolving, setBulkResolving] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [filterTab, setFilterTab] = useState<FilterTab>('unresolved')
  const [sortKey, setSortKey] = useState<SortKey>('confidence')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const fetchDupes = useCallback(async () => {
    setLoading(true)
    try {
      const params = filterTab === 'all' ? '' : `?resolved=${filterTab === 'resolved'}`
      const res = await fetch(`/api/dupes/${params}`)
      const data: DupeResult[] = await res.json()
      setDupes(data)
    } catch {
      setDupes([])
    } finally {
      setLoading(false)
    }
  }, [filterTab])

  useEffect(() => {
    fetchDupes()
  }, [fetchDupes])

  const handleAnalyze = async () => {
    setAnalyzing(true)
    try {
      await fetch('/api/dupes/analyze', { method: 'POST' })
      await fetchDupes()
    } finally {
      setAnalyzing(false)
    }
  }

  const handleResolve = async (groupId: number, keepTrackId: number) => {
    setResolving(prev => new Set(prev).add(groupId))
    try {
      await fetch(`/api/dupes/${groupId}/resolve?keep_track_id=${keepTrackId}`, { method: 'POST' })
      setDupes(prev => prev.filter(d => d.group.id !== groupId))
      if (expandedId === groupId) setExpandedId(null)
    } finally {
      setResolving(prev => {
        const next = new Set(prev)
        next.delete(groupId)
        return next
      })
    }
  }

  const handleResolveAll = async () => {
    if (!confirm(`Trash all losers across ${dupes.filter(d => !d.group.resolved).length} groups?`)) return
    setBulkResolving(true)
    try {
      await fetch('/api/dupes/resolve-all', { method: 'POST' })
      await fetchDupes()
    } finally {
      setBulkResolving(false)
    }
  }

  const sorted = [...dupes].sort((a, b) => {
    let cmp = 0
    switch (sortKey) {
      case 'confidence':
        cmp = a.group.confidence - b.group.confidence
        break
      case 'quality_gap':
        cmp = getQualityGap(a.members) - getQualityGap(b.members)
        break
      case 'artist':
        cmp = (a.members[0]?.artist ?? '').localeCompare(b.members[0]?.artist ?? '')
        break
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : ''

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'unresolved', label: 'Unresolved' },
    { key: 'resolved', label: 'Resolved' },
  ]

  const unresolvedCount = dupes.filter(d => !d.group.resolved).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Duplicates</h2>
        <div className="flex gap-3">
          {unresolvedCount > 0 && filterTab !== 'resolved' && (
            <button
              onClick={handleResolveAll}
              disabled={bulkResolving}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg text-sm font-medium transition-colors"
            >
              {bulkResolving ? 'Resolving...' : `Trash All Losers (${unresolvedCount})`}
            </button>
          )}
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg text-sm font-medium transition-colors"
          >
            {analyzing ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
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
      ) : sorted.length === 0 ? (
        <div className="text-zinc-500">No duplicate groups found. Run Analyze to scan your library.</div>
      ) : (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 text-left">
                <th className="px-4 py-3 font-medium w-8"></th>
                <th
                  className="px-4 py-3 font-medium cursor-pointer hover:text-white select-none"
                  onClick={() => toggleSort('artist')}
                >
                  Artist{sortIndicator('artist')}
                </th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Album</th>
                <th className="px-4 py-3 font-medium text-center">Members</th>
                <th
                  className="px-4 py-3 font-medium cursor-pointer hover:text-white select-none text-center"
                  onClick={() => toggleSort('quality_gap')}
                >
                  Quality Gap{sortIndicator('quality_gap')}
                </th>
                <th className="px-4 py-3 font-medium text-center">Match</th>
                <th
                  className="px-4 py-3 font-medium cursor-pointer hover:text-white select-none text-center"
                  onClick={() => toggleSort('confidence')}
                >
                  Confidence{sortIndicator('confidence')}
                </th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ group, members }) => {
                const winner = getWinner(members)
                const isExpanded = expandedId === group.id
                const isResolving = resolving.has(group.id)
                return (
                  <GroupRow
                    key={group.id}
                    group={group}
                    members={members}
                    winner={winner}
                    isExpanded={isExpanded}
                    isResolving={isResolving}
                    onToggle={() => setExpandedId(isExpanded ? null : group.id)}
                    onResolve={(keepId) => handleResolve(group.id, keepId)}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function GroupRow({
  group,
  members,
  winner,
  isExpanded,
  isResolving,
  onToggle,
  onResolve,
}: {
  group: DupeGroup
  members: Track[]
  winner: Track
  isExpanded: boolean
  isResolving: boolean
  onToggle: () => void
  onResolve: (keepId: number) => void
}) {
  const rep = members[0]
  const gap = getQualityGap(members)

  return (
    <>
      <tr
        className="border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <td className="px-4 py-3 text-zinc-500">
          <span className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
            &#9654;
          </span>
        </td>
        <td className="px-4 py-3">{rep?.artist ?? '-'}</td>
        <td className="px-4 py-3">{rep?.title ?? '-'}</td>
        <td className="px-4 py-3 text-zinc-400">{rep?.album ?? '-'}</td>
        <td className="px-4 py-3 text-center">{members.length}</td>
        <td className="px-4 py-3 text-center">
          <span className={gap > 20 ? 'text-amber-400' : 'text-zinc-400'}>{gap}</span>
        </td>
        <td className="px-4 py-3 text-center">
          <span className="px-2 py-0.5 rounded bg-zinc-800 text-xs text-zinc-300">
            {group.match_type}
          </span>
        </td>
        <td className="px-4 py-3 text-center">
          {group.confidence > 0 ? `${(group.confidence * 100).toFixed(0)}%` : '-'}
        </td>
        <td className="px-4 py-3 text-right">
          {!group.resolved ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onResolve(winner.id)
              }}
              disabled={isResolving}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-700 disabled:text-zinc-500 rounded text-xs font-medium transition-colors"
            >
              {isResolving ? '...' : 'Resolve'}
            </button>
          ) : (
            <span className="text-xs text-zinc-500">Resolved</span>
          )}
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b border-zinc-800/50">
          <td colSpan={9} className="p-0">
            <div className="bg-zinc-950/50 p-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-zinc-500 text-left">
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Format</th>
                    <th className="px-3 py-2 font-medium">Bitrate</th>
                    <th className="px-3 py-2 font-medium">Bit Depth</th>
                    <th className="px-3 py-2 font-medium">Sample Rate</th>
                    <th className="px-3 py-2 font-medium">Size</th>
                    <th className="px-3 py-2 font-medium">File Path</th>
                    {!group.resolved && <th className="px-3 py-2 font-medium text-right">Keep</th>}
                  </tr>
                </thead>
                <tbody>
                  {members.map(track => {
                    const isWinner = track.id === winner.id
                    return (
                      <tr
                        key={track.id}
                        className={
                          isWinner
                            ? 'bg-emerald-950/30 text-emerald-300'
                            : 'bg-red-950/20 text-zinc-500'
                        }
                      >
                        <td className="px-3 py-2">
                          {isWinner ? (
                            <span className="text-emerald-400 font-medium">KEEP</span>
                          ) : (
                            <span className="text-red-400 font-medium">TRASH</span>
                          )}
                        </td>
                        <td className="px-3 py-2 uppercase font-mono">{track.format}</td>
                        <td className="px-3 py-2 font-mono">
                          {track.bitrate > 0 ? `${track.bitrate} kbps` : '-'}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {track.bit_depth > 0 ? `${track.bit_depth}-bit` : '-'}
                        </td>
                        <td className="px-3 py-2 font-mono">{formatSampleRate(track.sample_rate)}</td>
                        <td className="px-3 py-2 font-mono">{formatBytes(track.file_size)}</td>
                        <td className="px-3 py-2 font-mono text-zinc-600 max-w-xs truncate" title={track.file_path}>
                          {track.file_path}
                        </td>
                        {!group.resolved && (
                          <td className="px-3 py-2 text-right">
                            {!isWinner && (
                              <button
                                onClick={() => onResolve(track.id)}
                                className="px-2 py-0.5 bg-zinc-700 hover:bg-zinc-600 rounded text-xs text-zinc-300 transition-colors"
                              >
                                Keep This
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
