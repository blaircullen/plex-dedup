import { useEffect, useState } from 'react'
import { GlassCard, Button, Skeleton, toast } from '../components/ui'
import { apiPut } from '../lib/api'

interface SettingsData {
  music_path: string
  trash_path: string
  fingerprint_threshold: string
  squid_rate_limit: string
}

export default function Settings() {
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [threshold, setThreshold] = useState('0.85')
  const [rateLimit, setRateLimit] = useState('3')

  useEffect(() => {
    fetch('/api/settings/')
      .then(r => r.json())
      .then((data: SettingsData) => {
        setSettings(data)
        setThreshold(data.fingerprint_threshold)
        setRateLimit(data.squid_rate_limit)
        setLoading(false)
      })
      .catch(() => {
        toast.error('Failed to load settings')
        setLoading(false)
      })
  }, [])

  const handleSave = async () => {
    const data = await apiPut<SettingsData>('/api/settings/', {
      fingerprint_threshold: threshold,
      squid_rate_limit: rateLimit,
    })
    setSettings(data)
    toast.success('Settings saved')
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold font-[family-name:var(--font-family-display)]">Settings</h2>

      <GlassCard className="p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-base-400 mb-1.5">Music Path</label>
          <div className="px-4 py-2.5 bg-base-800/50 border border-glass-border rounded-xl text-sm text-base-500 font-mono">
            {settings?.music_path}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-base-400 mb-1.5">Trash Path</label>
          <div className="px-4 py-2.5 bg-base-800/50 border border-glass-border rounded-xl text-sm text-base-500 font-mono">
            {settings?.trash_path}
          </div>
        </div>

        <div>
          <label htmlFor="threshold" className="block text-sm font-medium text-base-400 mb-1.5">
            Fingerprint Threshold: {threshold}
          </label>
          <input
            id="threshold"
            type="range"
            min="0.5"
            max="1.0"
            step="0.01"
            value={threshold}
            onChange={e => setThreshold(e.target.value)}
            className="w-full h-2 bg-base-700 rounded-full appearance-none cursor-pointer accent-lime"
          />
          <div className="flex justify-between text-xs text-base-500 mt-1">
            <span>0.50 (loose)</span>
            <span>1.00 (strict)</span>
          </div>
        </div>

        <div>
          <label htmlFor="rate-limit" className="block text-sm font-medium text-base-400 mb-1.5">
            Squid.wtf Rate Limit (seconds)
          </label>
          <input
            id="rate-limit"
            type="number"
            min="1"
            step="1"
            value={rateLimit}
            onChange={e => setRateLimit(e.target.value)}
            className="w-full px-4 py-2.5 bg-base-800/50 border border-glass-border rounded-xl text-sm text-white focus:outline-none focus:border-lime/50 focus:ring-1 focus:ring-lime/20 transition-all"
          />
          <p className="text-xs text-base-500 mt-1">Seconds between API requests to squid.wtf</p>
        </div>

        <div className="pt-2">
          <Button onClick={handleSave}>Save Settings</Button>
        </div>
      </GlassCard>

      <p className="text-center text-xs text-base-500 font-[family-name:var(--font-family-display)]">
        ShoopADupe v1.0
      </p>
    </div>
  )
}
