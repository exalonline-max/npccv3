import React, { useState } from 'react'
import axios from 'axios'
import { API_BASE } from '../../api/client'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function submit(e) {
    e.preventDefault()
    try {
      const res = await axios.post(API_BASE + '/auth/login', { email, password })
      const token = res.data.token
      localStorage.setItem('token', token)
      window.location.href = '/dashboard'
    } catch (err) {
      alert(err.response?.data?.message || err.message)
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
