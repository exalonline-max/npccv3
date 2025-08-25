import React from 'react'

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        })
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch (e) {
    return null
  }
}

export default function Dashboard() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const payload = token ? parseJwt(token) : null
  const email = payload?.email || payload?.sub || 'unknown@npcchatter.com'
  const seed = encodeURIComponent(email)
  const avatarUrl = `https://api.dicebear.com/6.x/identicon/svg?seed=${seed}`

  return (
    <div className="min-h-screen bg-base-200">
      <div className="navbar bg-base-100 shadow">
        <div className="flex-1 px-4">
          <span className="text-xl font-bold">NPC Chatter v3</span>
        </div>
        <div className="flex-none pr-4">
          <div className="flex items-center gap-3">
            <img src={avatarUrl} alt="avatar" className="w-10 h-10 rounded-full border" />
            <div className="hidden sm:block">
              <div className="text-sm">{email}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <h2 className="text-2xl font-semibold">Welcome</h2>
        <p className="mt-2">This is your dashboard. More features coming soon.</p>
      </div>
    </div>
  )
}
