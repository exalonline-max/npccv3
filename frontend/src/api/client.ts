const API_BASE = (import.meta.env.VITE_API_BASE || '') + '/api'

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
