import React, { useEffect, useState } from 'react'
import api from './api/client'

type NPC = { id: number; name: string; title: string }

export default function App() {
  const [health, setHealth] = useState<any>(null)
  const [npcs, setNpcs] = useState<NPC[]>([])
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')

  useEffect(() => {
    api.get('/health').then(r => setHealth(r))
    api.get('/npcs').then(r => setNpcs(r))
  }, [])

  async function addNpc(e: React.FormEvent) {
    e.preventDefault()
    const created = await api.post('/npcs', { name, title })
    setNpcs(prev => [...prev, created])
    setName('')
    setTitle('')
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>NPC Chatter v3</h1>
      <div>
        <strong>Health:</strong> {JSON.stringify(health)}
      </div>

      <h2>NPCs</h2>
      <ul>
        {npcs.map(n => (
          <li key={n.id}>{n.name} — {n.title}</li>
        ))}
      </ul>

      <h3>Add NPC</h3>
      <form onSubmit={addNpc}>
        <div>
          <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <button type="submit">Add</button>
      </form>
    </div>
  )
}
