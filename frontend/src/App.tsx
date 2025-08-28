import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import { Navigate } from 'react-router-dom'
import ToastProvider, { useToast } from './components/ToastProvider'
import AuthProvider from './contexts/AuthContext'

function AppInner(){
  // Guard against missing ToastProvider (defensive). If useToast throws or
  // returns null, provide a no-op addToast so socket callbacks won't crash.
  let addToast: any = () => {}
  try{
    const t: any = useToast()
    if (t && typeof t.addToast === 'function') addToast = t.addToast
  }catch(e){ /* missing provider - continue with noop */ }
  useEffect(()=>{
    // ensure socket is connected and listen for remote character updates
    import('./api/socket').then(s => {
      try{
        s.connectSocket()
        s.onCharacterUpdated((payload)=>{
          // show toast for remote updates
          try{
            const title = payload && payload.character ? `${payload.character.name || 'Character'} updated` : 'Character updated'
            const body = payload && payload.user_id ? `Player ${payload.user_id} updated their character` : ''
            try{ addToast({title, body, timeout: 4000}) }catch(e){}
            // dispatch global event so UI components refresh
            window.dispatchEvent(new CustomEvent('npcchatter:character-updated', {detail: payload.character || payload}))
          }catch(e){ }
        })
      }catch(e){ }
    }).catch(()=>{})
  }, [addToast])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AuthPage/>} />
        <Route path="/dashboard" element={localStorage.getItem('token') ? <Dashboard/> : <Navigate to='/' replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default function App(){
  return (
    <ToastProvider>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </ToastProvider>
  )
}
