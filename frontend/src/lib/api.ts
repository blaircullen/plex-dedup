import { toast } from '../components/ui/Toast'

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText)
    toast.error(`Request failed: ${msg}`)
    throw new Error(msg)
  }
  return res.json()
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText)
    toast.error(`Request failed: ${msg}`)
    throw new Error(msg)
  }
  return res.json()
}

export async function apiPut<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText)
    toast.error(`Request failed: ${msg}`)
    throw new Error(msg)
  }
  return res.json()
}
