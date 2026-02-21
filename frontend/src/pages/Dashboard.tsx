import { useEffect, useState, useCallback, useRef } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { Music, HardDrive, Copy, ArrowUpCircle, Loader2, AlertTriangle } from 'lucide-react'
import { useScan } from '../hooks/ScanContext'
import { GlassCard, StatCard, ProgressBar, Skeleton, toast } from '../components/ui'
import { apiGet } from '../lib/api'

interface Stats {
  total_tracks: number
  formats: { format: string; count: number }[]
  total_size_gb: number
  dupe_groups_unresolved: number
  dupe_groups_resolved: number
  upgrades_pending: number
}

const COLORS = ['#CCFF00', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981']

const PHASE_LABELS: Record<string, string> = {
  counting: 'Counting files...',
  scanning: 'Scanning library...',
  cleaning: 'Removing stale records...',
  analyzing: 'Analyzing duplicates...',
  complete: 'Scan complete',
  idle: 'Idle',
}

function formatElapsed(startedAt: number | null): string {
  if (!startedAt) return ''
  const elapsed = Math.floor(Date.now() / 1000 - startedAt)
  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const scan = useScan()

  const fetchStats = useCallback(() => {
    apiGet<Stats>('/api/stats/')
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const wasRunningRef = useRef(false)

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // Refresh stats when scan completes (includes auto dupe analysis)
  useEffect(() => {
    if (wasRunningRef.current && !scan.running) {
      fetchStats()
    }
    wasRunningRef.current = scan.running
  }, [scan.running, fetchStats])

  const startScan = async () => {
    try {
      await scan.requestScan()
      toast.success('Scan started')
    } catch {
      toast.error('Failed to start scan')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold font-[family-name:var(--font-family-display)]">Library Overview</h2>
        <button
          onClick={startScan}
          disabled={scan.running}
          className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed bg-lime text-base-900 hover:bg-lime/90"
        >
          {scan.running && <Loader2 className="w-4 h-4 animate-spin" />}
          {scan.running ? 'Scanning...' : 'Scan Now'}
        </button>
      </div>

      {scan.error && (
        <GlassCard className="p-4 border border-red-500/30 bg-red-500/5">
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>Unable to reach the backend. Check that the server is running.</span>
          </div>
        </GlassCard>
      )}

      {scan.running && (
        <GlassCard className="p-5">
          <ProgressBar
            value={scan.phase === 'scanning' ? scan.progress : undefined}
            max={scan.phase === 'scanning' ? scan.total : undefined}
            label={PHASE_LABELS[scan.phase] ?? 'Working...'}
            detail={scan.phase === 'scanning' && scan.total > 0
              ? `${scan.progress.toLocaleString()} / ${scan.total.toLocaleString()}`
              : scan.phase === 'cleaning' ? 'Checking for removed files...'
              : scan.phase === 'analyzing' ? 'Finding duplicate groups...'
              : scan.phase === 'counting' ? 'Counting audio files...'
              : 'Starting...'
            }
          />
          <div className="flex items-center justify-between mt-2">
            {scan.current_file && scan.phase === 'scanning' && (
              <p className="text-xs text-base-500 truncate flex-1 mr-4">{scan.current_file}</p>
            )}
            {scan.started_at && (
              <p className="text-xs text-base-500 whitespace-nowrap">Elapsed: {formatElapsed(scan.started_at)}</p>
            )}
          </div>
        </GlassCard>
      )}

      {stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Music} label="Total Tracks" value={stats.total_tracks.toLocaleString()} />
            <StatCard icon={HardDrive} label="Library Size" value={`${stats.total_size_gb} GB`} />
            <StatCard icon={Copy} label="Dupes Found" value={stats.dupe_groups_unresolved.toString()} />
            <StatCard icon={ArrowUpCircle} label="Upgrades Pending" value={stats.upgrades_pending.toString()} />
          </div>

          {stats.formats.length > 0 && (
            <GlassCard className="p-6">
              <h3 className="text-lg font-semibold font-[family-name:var(--font-family-display)] mb-4">Format Breakdown</h3>
              <div className="h-64">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={stats.formats}
                      dataKey="count"
                      nameKey="format"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      innerRadius={60}
                      strokeWidth={0}
                      label={({ name, value }: { name?: string; value?: number }) => `${(name ?? '').toUpperCase()} (${value ?? 0})`}
                    >
                      {stats.formats.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(17, 22, 39, 0.9)',
                        border: '1px solid rgba(90, 101, 133, 0.3)',
                        borderRadius: '12px',
                        color: '#e2e8f0',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          )}
        </>
      )}
    </div>
  )
}
