import React, { useState } from 'react'
import axios from 'axios'
import { API_BASE } from '../api/client'
import { setToken } from '../lib/token'
import LoginForm from '../components/auth/LoginForm'
import RegisterForm from '../components/auth/RegisterForm'

export default function AuthPage() {
  const [mode, setMode] = useState('login')
  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="card w-full max-w-md shadow-xl">
        <div className="card-body">
          <h1 className="card-title">NPC Chatter v3</h1>
          <div className="btn-group">
            <button onClick={()=>setMode('login')} className={`btn ${mode==='login'? 'btn-active btn-primary':'btn-ghost'}`}>Login</button>
            <button onClick={()=>setMode('register')} className={`${mode==='register'? 'btn-active btn-success':'btn-ghost'} btn`}>Register</button>
            <button onClick={async ()=>{
                // Dev button: create a fresh random dev user (development only).
                // Flow:
                // 1) generate random creds
                // 2) if a previous dev user email is stored in localStorage, try to delete it
                // 3) call backend /api/_dev/create_user to register new dev user
                // 4) store returned token and record dev_user_email in localStorage
                // Falls back to the offline fake-token only when network unreachable AND running Vite dev server.
                const rand = Math.random().toString(36).slice(2, 10)
                const email = `dev+${rand}@npcchatter.local`
                const username = `Dev${rand}`
                const password = `pw-${rand}`
                const prev = localStorage.getItem('dev_user_email')
                try {
                  // If previous dev user recorded, attempt to delete it (best-effort)
                  if (prev && import.meta.env && import.meta.env.DEV) {
                    try {
                      await axios.delete(API_BASE + '/_dev/delete_user', { data: { email: prev } })
                    } catch (e) {
                      // non-fatal
                      // eslint-disable-next-line no-console
                      console.debug('Could not delete previous dev user', prev, e?.response?.data || e.message)
                    }
                  }

                  // Create new dev user via backend dev endpoint when running locally (dev only).
                  let res
                      if (import.meta.env && import.meta.env.DEV) {
                    try {
                      res = await axios.post(API_BASE + '/_dev/create_user', { email, username, password })
                    } catch (e) {
                      // If backend create fails with 404/405 (endpoint not present or unsupported), fall back to legacy dev login
                      // eslint-disable-next-line no-console
                      console.debug('Dev create failed; falling back to legacy dev login', e?.response?.status, e?.response?.data || e.message)
                      try {
                        const loginRes = await axios.post(API_BASE + '/auth/login', { email: 'dev@npcchatter.com', password: 'password' })
                        const token = loginRes.data.token
                        try { const { setToken } = await import('../lib/token'); setToken(token) } catch(e){ try{ const t = typeof token === 'string' ? token : String(token); localStorage.setItem('token', t) }catch{} }
                        window.location.href = '/dashboard'
                        return
                      } catch (loginErr) {
                        throw e
                      }
                    }
                    const token = res?.data?.token
                    if (token) {
                      try { setToken(token) } catch(e){ try{ const t = typeof token === 'string' ? token : String(token); localStorage.setItem('token', t) }catch{} }
                      localStorage.setItem('dev_user_email', email)
                      window.location.href = '/dashboard'
                      return
                    }
                  } else {
                    // In production/staging don't call dev endpoints or attempt legacy dev login.
                    // The Dev button is intentionally disabled outside of Vite's dev mode to avoid
                    // creating or deleting test accounts on production environments.
                    alert('Dev shortcut is disabled in production. Run the frontend with Vite (npm run dev) to use the Dev button, or sign in with a real account.')
                    return
                  }
                } catch (err) {
                  const status = err.response?.status
                  const data = err.response?.data
                  // eslint-disable-next-line no-console
                  console.error('Dev create/login failed', { status, data, message: err.message })
                  const isNetwork = !err.response
                  if (isNetwork && import.meta.env && import.meta.env.DEV) {
                    const payload = {
                      email: 'dev@npcchatter.com',
                      username: 'DevUser',
                      speaks: ['Common','Elvish'],
                      role: 'dev',
                      'active-campaign': 'Dev Campaign'
                    }
                    function b64(obj){ return btoa(JSON.stringify(obj)).replace(/=/g,'') }
                    const fakeToken = `${b64({alg:'none'})}.${b64(payload)}.signature`
                    try { setToken(fakeToken) } catch(e){ try{ const t = typeof fakeToken === 'string' ? fakeToken : String(fakeToken); localStorage.setItem('token', t) }catch{} }
                    window.location.href = '/dashboard'
                    return
                  }
                  const msg = status ? `Dev action failed (status=${status}): ${data?.message || JSON.stringify(data)}` : `Dev action failed: ${err.message}`
                  alert(msg)
                }
              }} className="btn btn-warning">Dev</button>
            <span className="text-xs text-muted ml-2 self-center" title="Dev-only: creates a local fake token when backend is unreachable">(dev only)</span>
          </div>
          <div className="mt-4">
            {mode === 'login' ? <LoginForm /> : <RegisterForm />}
          </div>
        </div>
      </div>
    </div>
  )
}
