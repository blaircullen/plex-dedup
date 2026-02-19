import { useEffect, useState } from 'react'

interface TrashItem {
  id: number
  track_id: number
  artist: string
  title: string
  album: string
  format: string
  source_path: string
  dest_path: string
  performed_at: string
}

interface TrashSize {
  size_bytes: number
  size_mb: number
}

export default function Trash() {
  const [items, setItems] = useState<TrashItem[]>([])
  const [size, setSize] = useState<TrashSize | null>(null)
  const [loading, setLoading] = useState(true)
  const [restoring, setRestoring] = useState<number | null>(null)
  const [emptying, setEmptying] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    const [itemsRes, sizeRes] = await Promise.all([
      fetch('/api/trash/').then(r => r.json()),
      fetch('/api/trash/size').then(r => r.json()),
    ])
    setItems(itemsRes)
    setSize(sizeRes)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleRestore = async (actionId: number) => {
    setRestoring(actionId)
    await fetch(`/api/trash/${actionId}/restore`, { method: 'POST' })
    setRestoring(null)
    fetchData()
  }

  const handleEmpty = async () => {
    setEmptying(true)
    setShowConfirm(false)
    await fetch('/api/trash/empty', { method: 'POST' })
    setEmptying(false)
    fetchData()
  }

  if (loading) return <div className="text-zinc-500">Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Trash</h2>
        <button
          onClick={() => setShowConfirm(true)}
          disabled={emptying || items.length === 0}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg text-sm font-medium transition-colors"
        >
          {emptying ? 'Emptying...' : 'Empty Trash'}
        </button>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-md w-full mx-4 space-y-4">
            <h3 className="text-lg font-semibold">Confirm Empty Trash</h3>
            <p className="text-zinc-400 text-sm">
              This will permanently delete all {items.length} trashed item{items.length !== 1 ? 's' : ''}. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEmpty}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {size && (
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 inline-block">
          <div className="text-sm text-zinc-500 mb-1">Trash Size</div>
          <div className="text-2xl font-bold">
            {size.size_mb >= 1024
              ? `${(size.size_mb / 1024).toFixed(2)} GB`
              : `${size.size_mb} MB`}
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-zinc-500">Trash is empty.</p>
      ) : (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-left">
                  <th className="px-4 py-3 font-medium">Artist</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Album</th>
                  <th className="px-4 py-3 font-medium">Format</th>
                  <th className="px-4 py-3 font-medium">Original Path</th>
                  <th className="px-4 py-3 font-medium">Trashed</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-4 py-3">{item.artist || '--'}</td>
                    <td className="px-4 py-3">{item.title || '--'}</td>
                    <td className="px-4 py-3">{item.album || '--'}</td>
                    <td className="px-4 py-3 uppercase">{item.format || '--'}</td>
                    <td className="px-4 py-3 text-zinc-400 font-mono text-xs max-w-xs truncate" title={item.source_path}>
                      {item.source_path}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {new Date(item.performed_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleRestore(item.id)}
                        disabled={restoring === item.id}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 rounded text-xs font-medium transition-colors"
                      >
                        {restoring === item.id ? 'Restoring...' : 'Restore'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
