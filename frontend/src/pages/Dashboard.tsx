import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useScanProgress } from '../hooks/useScanProgress'

interface Stats {
  total_tracks: number
  formats: { format: string; count: number }[]
  total_size_gb: number
  dupe_groups_unresolved: number
  dupe_groups_resolved: number
  upgrades_pending: number
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const progress = useScanProgress()

  useEffect(() => {
    fetch('/api/stats/').then(r => r.json()).then(setStats)
  }, [])

  const startScan = async () => {
    await fetch('/api/scan/start', { method: 'POST' })
  }

  if (!stats) return <div className="text-zinc-500">Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Library Overview</h2>
        <button
          onClick={startScan}
          disabled={progress.running}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg text-sm font-medium transition-colors"
        >
          {progress.running ? 'Scanning...' : 'Scan Now'}
        </button>
      </div>

      {progress.running && (
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium">Scanning...</h3>
            <span className="text-sm text-zinc-400">
              {progress.progress.toLocaleString()} / {progress.total.toLocaleString()}
            </span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.total > 0 ? (progress.progress / progress.total) * 100 : 0}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500 mt-2 truncate">{progress.current_file}</p>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        {[
          ['Total Tracks', stats.total_tracks.toLocaleString()],
          ['Library Size', `${stats.total_size_gb} GB`],
          ['Dupes Found', stats.dupe_groups_unresolved.toString()],
          ['Upgrades Pending', stats.upgrades_pending.toString()],
        ].map(([label, value]) => (
          <div key={label} className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
            <div className="text-sm text-zinc-500 mb-1">{label}</div>
            <div className="text-2xl font-bold">{value}</div>
          </div>
        ))}
      </div>

      {stats.formats.length > 0 && (
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
          <h3 className="text-lg font-semibold mb-4">Format Breakdown</h3>
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
                  label={({ name, value }: { name?: string; value?: number }) => `${(name ?? '').toUpperCase()} (${value ?? 0})`}
                >
                  {stats.formats.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
