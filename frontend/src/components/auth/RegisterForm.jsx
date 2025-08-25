import React, { useState } from 'react'
import axios from 'axios'
import { API_BASE } from '../../api/client'

export default function RegisterForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [username, setUsername] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (password !== confirm) return alert('Passwords do not match')
    try {
      const res = await axios.post(API_BASE + '/auth/register', { email, password, username })
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
        <label className="block text-sm font-medium">Username</label>
        <input value={username} onChange={e=>setUsername(e.target.value)} className="w-full border rounded px-2 py-1" required />
      </div>
      <div>
        <label className="block text-sm font-medium">Email</label>
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full border rounded px-2 py-1" required />
      </div>
      <div>
        <label className="block text-sm font-medium">Password</label>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full border rounded px-2 py-1" required />
      </div>
      <div>
        <label className="block text-sm font-medium">Confirm Password</label>
        <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} className="w-full border rounded px-2 py-1" required />
      </div>
      <div>
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">Register</button>
      </div>
    </form>
  )
}
