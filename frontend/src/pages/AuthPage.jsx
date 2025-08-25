import React, { useState } from 'react'
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
          </div>
          <div className="mt-4">
            {mode === 'login' ? <LoginForm /> : <RegisterForm />}
          </div>
        </div>
      </div>
    </div>
  )
}
