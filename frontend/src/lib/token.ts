// Helper utilities to normalize token storage and retrieval.
// Ensure we always store a string JWT and never accidentally persist objects.
export function normalizeRaw(raw: any): string | null {
  if (!raw) return null
  // If it's already a string, trim whitespace
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (!s) return null
    // strip optional Bearer prefix
    if (s.toLowerCase().startsWith('bearer ')) return s.slice(7).trim()
    return s
  }
  // If it's an object, try common shapes
  if (typeof raw === 'object') {
    if (raw.token && typeof raw.token === 'string') return raw.token
    if (raw.access_token && typeof raw.access_token === 'string') return raw.access_token
    // if the object looks like a JWT payload (has sub/email) then it's not a token
    // avoid storing that
    return null
  }
  // fall back to string coercion
  try { return String(raw) } catch (e) { return null }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('token')
    return normalizeRaw(raw)
  } catch (e) {
    return null
  }
}

export function setToken(raw: any){
  if (typeof window === 'undefined') return
  try{
    const normalized = normalizeRaw(raw)
    if (normalized) localStorage.setItem('token', normalized)
    else localStorage.removeItem('token')
  }catch(e){
    try{ localStorage.removeItem('token') }catch(_){}
  }
}

export function clearToken(){
  if (typeof window === 'undefined') return
  try{ localStorage.removeItem('token') }catch(e){}
}

export default { getToken, setToken, clearToken }
