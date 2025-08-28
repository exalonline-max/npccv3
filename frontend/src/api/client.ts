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
let API_BASE = (_base.replace(/\/$/, '') || '') + '/api'

// Runtime fallback: if the application was built without VITE_API_BASE
// the client will be using a relative '/api' path. That can cause POST
// requests to be handled by the static server (rewrite to index.html)
// which returns HTML or a 405. When running on Render's default domain
// (hostname ends with .onrender.com) we can safely point API requests to
// the backend service used in `render.yaml`.
if (typeof window !== 'undefined') {
  try {
    if (API_BASE === '/api') {
      const host = window.location.hostname || ''
      if (host.endsWith('.onrender.com')) {
        const fallback = 'https://npcchatter-backend.onrender.com/api'
        // eslint-disable-next-line no-console
        console.warn('VITE_API_BASE not set; falling back to', fallback)
        API_BASE = fallback
      }
    }
  } catch (e) {
    // ignore
  }
}

export { API_BASE }

type ReqOptions = {
  method?: string
  body?: any
}

async function req(path: string, opts: ReqOptions = {}) {
  const headers: Record<string,string> = { 'Content-Type': 'application/json' }
  // Attach auth token if available (normalized)
  try {
    // lazy import to avoid circular deps in some test harnesses
    const { getToken } = await import('../lib/token')
    const token = getToken()
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
    if (res.status === 503) {
      // Backend signals service unavailable (DB down etc.). Throw a typed error
      const text = await res.text().catch(()=>res.statusText)
      const err = new Error(text || 'service unavailable')
      // @ts-ignore add a discriminant for callers
      err.name = 'ApiUnavailableError'
      throw err
    }
    // Try to produce a helpful error. If the server returned HTML it's
    // usually because the request hit the static frontend (rewrite to
    // index.html) or some proxy that doesn't allow the HTTP method.
    const contentType = res.headers.get('content-type') || ''
    const text = await res.text()
    if (contentType.includes('text/html')) {
      const preview = text.replace(/\s+/g, ' ').slice(0, 300)
      throw new Error(`Unexpected HTML response from API (status=${res.status}): ${preview}... - this often means VITE_API_BASE is not pointing at the backend and the static server handled the request.`)
    }
    // otherwise return the raw body or statusText
    throw new Error(text || res.statusText)
  }
  return res.status === 204 ? null : res.json()
}

export default {
  get: (p: string) => req(p, { method: 'GET' }),
  post: (p: string, body: any) => req(p, { method: 'POST', body }),
  put: (p: string, body: any) => req(p, { method: 'PUT', body }),
}
