import { useEffect, useState } from 'react'

interface SettingsData {
  music_path: string
  trash_path: string
  fingerprint_threshold: string
  squid_rate_limit: string
}

export default function Settings() {
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
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
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    const res = await fetch('/api/settings/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fingerprint_threshold: threshold,
        squid_rate_limit: rateLimit,
      }),
    })
    const data: SettingsData = await res.json()
    setSettings(data)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <div className="text-zinc-500">Loading...</div>

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold">Settings</h2>

      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-5">
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">Music Path</label>
          <div className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-500 font-mono">
            {settings?.music_path}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">Trash Path</label>
          <div className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-500 font-mono">
            {settings?.trash_path}
          </div>
        </div>

        <div>
          <label htmlFor="threshold" className="block text-sm font-medium text-zinc-400 mb-1">
            Fingerprint Threshold
          </label>
          <input
            id="threshold"
            type="number"
            min="0.5"
            max="1.0"
            step="0.01"
            value={threshold}
            onChange={e => setThreshold(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <p className="text-xs text-zinc-600 mt-1">How similar two fingerprints must be to count as a match (0.5 - 1.0)</p>
        </div>

        <div>
          <label htmlFor="rate-limit" className="block text-sm font-medium text-zinc-400 mb-1">
            Squid.wtf Rate Limit
          </label>
          <input
            id="rate-limit"
            type="number"
            min="1"
            step="1"
            value={rateLimit}
            onChange={e => setRateLimit(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <p className="text-xs text-zinc-600 mt-1">Seconds between API requests to squid.wtf</p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {saved && <span className="text-sm text-green-500">Settings saved</span>}
        </div>
      </div>
    </div>
  )
}
