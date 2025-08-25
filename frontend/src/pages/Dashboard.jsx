import React from 'react'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar/Sidebar'

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-base-200">
      <Topbar />

      <div className="flex pt-16">
        <Sidebar />
        <main className="flex-1 p-6">
          <h2 className="text-2xl font-semibold">Welcome</h2>
          <p className="mt-2">This is your dashboard. More features coming soon.</p>
        </main>
      </div>
    </div>
  )
}
