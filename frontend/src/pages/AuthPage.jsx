import React, { useState } from 'react'
import LoginForm from '../components/auth/LoginForm'
import RegisterForm from '../components/auth/RegisterForm'

export default function AuthPage() {
  const [mode, setMode] = useState('login')
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white p-8 rounded shadow">
        <h1 className="text-2xl font-bold mb-4">NPC Chatter v3</h1>
        <div className="mb-4">
          <button onClick={()=>setMode('login')} className={`mr-2 px-4 py-2 rounded ${mode==='login'? 'bg-blue-600 text-white':'bg-gray-200'}`}>Login</button>
          <button onClick={()=>setMode('register')} className={`${mode==='register'? 'bg-green-600 text-white':'bg-gray-200'} px-4 py-2 rounded`}>Register</button>
        </div>
        <div>
          {mode === 'login' ? <LoginForm /> : <RegisterForm />}
        </div>
      </div>
    </div>
  )
}
