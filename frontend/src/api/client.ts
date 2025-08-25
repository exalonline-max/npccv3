// Normalize VITE_API_BASE: Render's Blueprint `fromService.property: host` returns
// a hostname without scheme (e.g. "npcchatter-backend.onrender.com").
// Ensure we have a full https:// URL so fetch works correctly.
let _base = import.meta.env.VITE_API_BASE || ''
if (_base && !/^https?:\/\//i.test(_base)) {
  _base = 'https://' + _base
}
const API_BASE = (_base.replace(/\/$/, '') || '') + '/api'

export { API_BASE }

type ReqOptions = {
  method?: string
  body?: any
}

async function req(path: string, opts: ReqOptions = {}) {
  const res = await fetch(API_BASE + path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
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
}
