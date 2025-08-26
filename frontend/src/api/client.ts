// Normalize VITE_API_BASE: Render's Blueprint `fromService.property: host` returns
// a hostname without scheme (e.g. "npcchatter-backend.onrender.com").
// Ensure we have a full https:// URL so fetch works correctly.
let _base = import.meta.env.VITE_API_BASE || ''
if (_base && !/^https?:\/\//i.test(_base)) {
  _base = 'https://' + _base
}
// If Render injects a short service name (e.g. "npcchatter-backend") the
// browser can't resolve that. Append the default Render domain so the URL
// becomes "https://npcchatter-backend.onrender.com" which is resolvable.
if (_base && /^https:\/\/[^.\/]+$/.test(_base)) {
  _base = _base + '.onrender.com'
}
const API_BASE = (_base.replace(/\/$/, '') || '') + '/api'

export { API_BASE }

type ReqOptions = {
  method?: string
  body?: any
}

async function req(path: string, opts: ReqOptions = {}) {
  const headers: Record<string,string> = { 'Content-Type': 'application/json' }
  // Attach auth token if available
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    if (token) headers['Authorization'] = `Bearer ${token}`
  } catch (e) {}
  // Attach active campaign header when present in localStorage
  try {
    const active = typeof window !== 'undefined' ? localStorage.getItem('activeCampaign') : null
    if (active) headers['X-Active-Campaign'] = active
  } catch (e) {}

  const res = await fetch(API_BASE + path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }
  return res.status === 204 ? null : res.json()
}

export default {
  get: (p: string) => req(p, { method: 'GET' }),
  post: (p: string, body: any) => req(p, { method: 'POST', body }),
  put: (p: string, body: any) => req(p, { method: 'PUT', body }),
}
