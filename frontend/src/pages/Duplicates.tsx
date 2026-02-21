import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Copy, Search, Trash2, ChevronRight, Loader2 } from 'lucide-react'
import { GlassCard, Button, Badge, EmptyState, SkeletonTable, Modal, toast } from '../components/ui'

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
  const [resolving, setResolving] = useState<Set<number>>(new Set())
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [filterTab, setFilterTab] = useState<FilterTab>('unresolved')
  const [sortKey, setSortKey] = useState<SortKey>('confidence')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [resolvingAll, setResolvingAll] = useState(false)

  const fetchDupes = useCallback(async () => {
    setLoading(true)
    try {
      const params = filterTab === 'all' ? '' : `?resolved=${filterTab === 'resolved'}`
      const res = await fetch(`/api/dupes/${params}`)
      const data: DupeResult[] = await res.json()
      setDupes(data)
    } catch {
      toast.error('Failed to load duplicates')
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
      const res = await fetch('/api/dupes/analyze', { method: 'POST' })
      const data = await res.json()
      if (data.auto_resolved > 0) {
        toast.success(`Analysis complete — ${data.auto_resolved} high-confidence duplicates auto-resolved`)
      } else {
        toast.success('Analysis complete')
      }
      await fetchDupes()
    } catch {
      toast.error('Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleResolve = async (groupId: number, keepTrackId: number, members: Track[]) => {
    const winner = members.find(t => t.id === keepTrackId)
    setResolving(prev => new Set(prev).add(groupId))
    try {
      const res = await fetch(`/api/dupes/${groupId}/resolve?keep_track_id=${keepTrackId}`, { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      setDupes(prev => prev.filter(d => d.group.id !== groupId))
      if (expandedId === groupId) setExpandedId(null)
      toast.success(`Resolved: ${winner?.artist} - ${winner?.title} (kept ${winner?.format.toUpperCase()})`)
    } catch {
      toast.error('Failed to resolve group')
    } finally {
      setResolving(prev => { const next = new Set(prev); next.delete(groupId); return next })
    }
  }

  const handleResolveAll = async () => {
    setShowBulkModal(false)
    setResolvingAll(true)
    try {
      const res = await fetch('/api/dupes/resolve-all', { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      toast.success(`Resolved all duplicate groups`)
      await fetchDupes()
    } catch {
      toast.error('Failed to resolve all')
    } finally {
      setResolvingAll(false)
    }
  }

  const sorted = [...dupes].sort((a, b) => {
    let cmp = 0
    switch (sortKey) {
      case 'confidence': cmp = a.group.confidence - b.group.confidence; break
      case 'quality_gap': cmp = getQualityGap(a.members) - getQualityGap(b.members); break
      case 'artist': cmp = (a.members[0]?.artist ?? '').localeCompare(b.members[0]?.artist ?? ''); break
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sortIndicator = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : ''

  const unresolvedCount = dupes.filter(d => !d.group.resolved).length

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'unresolved', label: 'Unresolved' },
    { key: 'resolved', label: 'Resolved' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold font-[family-name:var(--font-family-display)]">Duplicates</h2>
        <div className="flex gap-3">
          {unresolvedCount > 0 && filterTab !== 'resolved' && (
            <Button variant="danger" onClick={() => setShowBulkModal(true)} disabled={resolvingAll}>
              {resolvingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {resolvingAll ? 'Resolving...' : `Trash All Losers (${unresolvedCount})`}
            </Button>
          )}
          <Button variant="secondary" onClick={handleAnalyze} disabled={analyzing}>
            {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {analyzing ? 'Analyzing...' : 'Analyze'}
          </Button>
        </div>
      </div>

      <Modal open={showBulkModal} onClose={() => setShowBulkModal(false)}>
        <h3 className="text-lg font-semibold font-[family-name:var(--font-family-display)] mb-2">Confirm Bulk Resolve</h3>
        <p className="text-base-400 text-sm mb-6">
          This will trash losers across {unresolvedCount} groups, keeping the highest quality version of each.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setShowBulkModal(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleResolveAll}>Trash All Losers</Button>
        </div>
      </Modal>

      <div className="flex gap-2">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilterTab(tab.key)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              filterTab === tab.key
                ? 'bg-lime-dim text-lime border border-lime/20'
                : 'text-base-400 hover:text-white hover:bg-base-700/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonTable rows={6} cols={8} />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={Copy}
          title="No duplicates found"
          description="Run Analyze to scan your library for duplicate tracks."
        />
      ) : (
        <GlassCard className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-glass-border text-base-400 text-left">
                <th className="px-4 py-3 font-medium w-8"></th>
                <th className="px-4 py-3 font-medium cursor-pointer hover:text-white select-none" onClick={() => toggleSort('artist')}>
                  Artist{sortIndicator('artist')}
                </th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Album</th>
                <th className="px-4 py-3 font-medium text-center">Members</th>
                <th className="px-4 py-3 font-medium cursor-pointer hover:text-white select-none text-center" onClick={() => toggleSort('quality_gap')}>
                  Quality Gap{sortIndicator('quality_gap')}
                </th>
                <th className="px-4 py-3 font-medium text-center">Match</th>
                <th className="px-4 py-3 font-medium cursor-pointer hover:text-white select-none text-center" onClick={() => toggleSort('confidence')}>
                  Confidence{sortIndicator('confidence')}
                </th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {sorted.map(({ group, members }) => {
                  const winner = getWinner(members)
                  const isExpanded = expandedId === group.id
                  const isResolving = resolving.has(group.id)
                  const rep = members[0]
                  const gap = getQualityGap(members)
                  return (
                    <GroupRows
                      key={group.id}
                      group={group}
                      members={members}
                      winner={winner}
                      rep={rep}
                      gap={gap}
                      isExpanded={isExpanded}
                      isResolving={isResolving}
                      onToggle={() => setExpandedId(isExpanded ? null : group.id)}
                      onResolve={(keepId) => handleResolve(group.id, keepId, members)}
                    />
                  )
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </GlassCard>
      )}
    </div>
  )
}

function GroupRows({
  group, members, winner, rep, gap, isExpanded, isResolving, onToggle, onResolve,
}: {
  group: DupeGroup; members: Track[]; winner: Track; rep: Track; gap: number
  isExpanded: boolean; isResolving: boolean; onToggle: () => void; onResolve: (keepId: number) => void
}) {
  return (
    <>
      <motion.tr
        layout
        exit={{ opacity: 0, height: 0 }}
        className="border-b border-glass-border/50 hover:bg-base-800/30 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <td className="px-4 py-3 text-base-500">
          <motion.span animate={{ rotate: isExpanded ? 90 : 0 }} className="inline-block">
            <ChevronRight className="w-4 h-4" />
          </motion.span>
        </td>
        <td className="px-4 py-3">{rep?.artist ?? '-'}</td>
        <td className="px-4 py-3">{rep?.title ?? '-'}</td>
        <td className="px-4 py-3 text-base-400">{rep?.album ?? '-'}</td>
        <td className="px-4 py-3 text-center">{members.length}</td>
        <td className="px-4 py-3 text-center">
          <span className={gap > 20 ? 'text-amber-400' : 'text-base-400'}>{gap}</span>
        </td>
        <td className="px-4 py-3 text-center">
          <Badge>{group.match_type}</Badge>
        </td>
        <td className="px-4 py-3 text-center">
          {group.confidence > 0 ? `${(group.confidence * 100).toFixed(0)}%` : '-'}
        </td>
        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
          {!group.resolved ? (
            <Button
              size="sm"
              variant="primary"
              onClick={() => onResolve(winner.id)}
              disabled={isResolving}
            >
              Resolve
            </Button>
          ) : (
            <Badge variant="emerald">Resolved</Badge>
          )}
        </td>
      </motion.tr>
      <AnimatePresence>
        {isExpanded && (
          <motion.tr
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="border-b border-glass-border/50"
          >
            <td colSpan={9} className="p-0">
              <div className="bg-base-900/50 p-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-base-500 text-left">
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
                          className={isWinner
                            ? 'border-l-2 border-lime bg-lime/5'
                            : 'border-l-2 border-red-500/50 bg-red-500/5'
                          }
                        >
                          <td className="px-3 py-2">
                            {isWinner
                              ? <Badge variant="lime">KEEP</Badge>
                              : <Badge variant="red">TRASH</Badge>
                            }
                          </td>
                          <td className="px-3 py-2 uppercase font-mono">{track.format}</td>
                          <td className="px-3 py-2 font-mono">{track.bitrate > 0 ? `${track.bitrate} kbps` : '-'}</td>
                          <td className="px-3 py-2 font-mono">{track.bit_depth > 0 ? `${track.bit_depth}-bit` : '-'}</td>
                          <td className="px-3 py-2 font-mono">{formatSampleRate(track.sample_rate)}</td>
                          <td className="px-3 py-2 font-mono">{formatBytes(track.file_size)}</td>
                          <td className="px-3 py-2 font-mono text-base-500 max-w-xs truncate" title={track.file_path}>{track.file_path}</td>
                          {!group.resolved && (
                            <td className="px-3 py-2 text-right">
                              {!isWinner && (
                                <Button size="sm" variant="ghost" onClick={() => onResolve(track.id)}>Keep This</Button>
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
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  )
}
