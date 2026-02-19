import { useEffect, useState, useCallback } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { Music, HardDrive, Copy, ArrowUpCircle } from 'lucide-react'
import { useScanProgress } from '../hooks/useScanProgress'
import { GlassCard, StatCard, Button, ProgressBar, Skeleton, toast } from '../components/ui'
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

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(() => {
    apiGet<Stats>('/api/stats/')
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const progress = useScanProgress(fetchStats)

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const startScan = async () => {
    await fetch('/api/scan/start', { method: 'POST' })
    toast.success('Scan started')
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
        <Button onClick={startScan} disabled={progress.running}>
          {progress.running ? 'Scanning...' : 'Scan Now'}
        </Button>
      </div>

      {progress.running && (
        <GlassCard className="p-5">
          <ProgressBar
            value={progress.progress}
            max={progress.total}
            label="Scanning library..."
            detail={`${progress.progress.toLocaleString()} / ${progress.total.toLocaleString()}`}
          />
          <p className="text-xs text-base-500 mt-2 truncate">{progress.current_file}</p>
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
