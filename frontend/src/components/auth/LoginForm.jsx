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
      <div>
        <label className="block text-sm font-medium">Email</label>
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full border rounded px-2 py-1" required />
      </div>
      <div>
        <label className="block text-sm font-medium">Password</label>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full border rounded px-2 py-1" required />
      </div>
      <div>
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Login</button>
      </div>
    </form>
  )
}
