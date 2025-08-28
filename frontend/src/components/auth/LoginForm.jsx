import React, { useState } from 'react'
import client from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const auth = useAuth()

  async function submit(e) {
    e.preventDefault()
    try {
  const res = await client.post('/auth/login', { email, password })
  const token = res?.token || (res && res.token) || null
  const user = res?.user || null
  auth.setAuth(token, user)
  window.location.href = '/dashboard'
    } catch (err) {
      alert(err.message || JSON.stringify(err))
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="form-control">
        <label className="label"><span className="label-text">Email</span></label>
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="input input-bordered w-full" required />
      </div>
      <div className="form-control">
        <label className="label"><span className="label-text">Password</span></label>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="input input-bordered w-full" required />
      </div>
      <div className="form-control mt-4">
        <button type="submit" className="btn btn-primary">Login</button>
      </div>
    </form>
  )
}
