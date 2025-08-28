import React from 'react'
import { API_BASE } from '../api/client'

export default function ApiHealthBanner(){
  const [state, setState] = React.useState({status: 'unknown', info: null, error: null, dismissed: false})

  React.useEffect(()=>{
    let cancelled = false
    async function check(){
      try{
        const base = API_BASE || '/api'
        const res = await fetch(base + '/env', { method: 'GET' })
        if (!res.ok) throw new Error('non-OK')
        const info = await res.json()
        if (!cancelled) setState({status: 'ok', info, error: null, dismissed: false})
      }catch(e){
        if (!cancelled) setState({status: 'fail', info: null, error: String(e), dismissed: false})
      }
    }
    check()
    return ()=>{ cancelled = true }
  }, [])

  if (state.dismissed) return null
  if (state.status === 'unknown') return null

  const isBad = state.status === 'fail' || (state.info && state.info.app_env === 'production' && !state.info.allowed_origins)

  if (!isBad) return null

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50">
      <div className="alert shadow-lg max-w-3xl">
        <div>
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M21 12A9 9 0 1 1 3 12 9 9 0 0 1 21 12z" /></svg>
          <div>
            <h3 className="font-bold">API configuration issue</h3>
            <div className="text-sm">The frontend could not reach the backend API or the API appears to be missing required configuration (ALLOWED_ORIGINS / DATABASE / REDIS). This will prevent actions like joining a campaign.</div>
            <div className="text-xs text-muted mt-1">Details: {state.error || JSON.stringify(state.info)}</div>
          </div>
        </div>
        <div className="flex-none">
          <button className="btn btn-ghost" onClick={()=>setState(s=>({...s, dismissed:true}))}>Dismiss</button>
        </div>
      </div>
    </div>
  )
}
