import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import ApiHealthBanner from './components/ApiHealthBanner'

// Sanitize stored token on startup: remove clearly invalid or unsigned (alg='none')
// tokens to avoid accidental 401s for users who previously used a dev fallback.
function sanitizeStoredToken() {
  try {
    if (typeof window === 'undefined') return
  const t = localStorage.getItem('token')
  if (!t || typeof t !== 'string') return
  const parts = t.split('.')
    if (parts.length !== 3) {
      console.warn('Clearing invalid token from localStorage (wrong JWT format)')
      localStorage.removeItem('token')
      return
    }
    try {
      const raw = parts[0].replace(/-/g, '+').replace(/_/g, '/')
      const hdr = JSON.parse(atob(raw))
      if (hdr && hdr.alg && String(hdr.alg).toLowerCase() === 'none') {
        console.warn('Clearing unsigned dev token from localStorage')
        localStorage.removeItem('token')
      }
    } catch (e) {
      // If header can't be parsed, remove the token to be safe.
      console.warn('Could not parse JWT header; clearing token for safety', e)
      localStorage.removeItem('token')
    }
  } catch (e) {
    // Any unexpected error: don't block app, but clear token for safety
    try { localStorage.removeItem('token') } catch (_) {}
    console.warn('Error while sanitizing token', e)
  }
}

sanitizeStoredToken()

const root = createRoot(document.getElementById('root')!)
root.render(
  React.createElement(
    React.StrictMode,
    null,
    React.createElement(ErrorBoundary, null,
      React.createElement(ApiHealthBanner, null),
      React.createElement(App, null)
    )
  )
)
