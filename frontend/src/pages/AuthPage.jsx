import React, { useState } from 'react'
import axios from 'axios'
import { API_BASE } from '../api/client'
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
                // Temporary dev-login button for testing. Create a fake unsigned token ONLY in Vite dev mode.
                try {
                  const res = await axios.post(API_BASE + '/auth/login', { email: 'dev@npcchatter.com', password: 'password' })
                  const token = res.data.token
                  localStorage.setItem('token', token)
                  window.location.href = '/dashboard'
                } catch (err) {
                  const isNetwork = !err.response
                  // Only use the offline fake token when running in dev mode. This prevents unsigned tokens
                  // from being stored in production builds which the backend will reject with 401.
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
                    localStorage.setItem('token', fakeToken)
                    window.location.href = '/dashboard'
                  } else {
                    alert(err.response?.data?.message || err.message)
                  }
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
