export function parseJwt(token) {
  if (!token) return null
  // If token is already an object (payload), return it
  if (typeof token === 'object') return token
  if (typeof token !== 'string') return null
  try {
    const parts = token.split('.')
    if (!parts || parts.length < 2) return null
    const base64Url = parts[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        })
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch (e) {
    return null
  }
}

export default parseJwt
