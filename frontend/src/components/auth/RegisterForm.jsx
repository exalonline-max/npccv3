import React, { useState } from 'react'
import client from '../../api/client'

export default function RegisterForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [username, setUsername] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (password !== confirm) return alert('Passwords do not match')
    try {
      const res = await client.post('/auth/register', { email, password, username })
      const token = res?.token || (res && res.token) || null
      try { const { setToken } = await import('../../lib/token'); setToken(token) } catch(e){ localStorage.setItem('token', token) }
      window.location.href = '/dashboard'
    } catch (err) {
      alert(err.message || JSON.stringify(err))
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="form-control">
        <label className="label"><span className="label-text">Username</span></label>
        <input value={username} onChange={e=>setUsername(e.target.value)} className="input input-bordered w-full" required />
      </div>
      <div className="form-control">
        <label className="label"><span className="label-text">Email</span></label>
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="input input-bordered w-full" required />
      </div>
      <div className="form-control">
        <label className="label"><span className="label-text">Password</span></label>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="input input-bordered w-full" required />
      </div>
      <div className="form-control">
        <label className="label"><span className="label-text">Confirm Password</span></label>
        <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} className="input input-bordered w-full" required />
      </div>
      <div className="form-control mt-4">
        <button type="submit" className="btn btn-success">Register</button>
      </div>
    </form>
  )
}
