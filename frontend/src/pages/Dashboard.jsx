import React from 'react'
import Topbar from '../components/Topbar'

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-base-200">
      <Topbar />

      <div className="p-6">
        <h2 className="text-2xl font-semibold">Welcome</h2>
        <p className="mt-2">This is your dashboard. More features coming soon.</p>
      </div>
    </div>
  )
}
