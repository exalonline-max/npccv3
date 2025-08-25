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

const NAMES = [
  'Thorin Oakenshield',
  'Lyra Moonshadow',
  'Garruk Stonefist',
  'Elandra Swiftwind',
  'Merric Underbough',
  'Seraphine Dusk',
  'Orrin Blackwater',
]

function pickName(seed) {
  if (!seed) return NAMES[Math.floor(Math.random()*NAMES.length)]
  let s = 0
  for (let i=0;i<seed.length;i++) s += seed.charCodeAt(i)
  return NAMES[s % NAMES.length]
}

export default function PlayerFrame(){
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const payload = token ? parseJwt(token) : null
  const seed = payload?.email || payload?.sub || String(Date.now())
  const name = payload?.username || pickName(seed)
  const avatar = `https://api.dicebear.com/6.x/avataaars/svg?seed=${encodeURIComponent(seed)}`

  // Mocked stats
  const maxHp = 40
  const hp = Math.floor(Math.random() * (maxHp - 10)) + 10
  const status = Math.random() > 0.85 ? 'Poisoned' : 'Healthy'
  const spellslots = {1:3,2:2,3:1}

  return (
    <div className="card bg-base-200 p-3">
      <div className="flex items-center space-x-3">
        <div className="w-16 h-16 rounded-full overflow-hidden border">
          <img src={avatar} alt="portrait" className="w-full h-full object-cover"/>
        </div>
        <div>
          <div className="font-semibold">{name}</div>
          <div className="text-sm text-muted">Level 3 Fighter</div>
        </div>
      </div>

      <div className="mt-3">
        <div className="text-sm mb-1">HP</div>
        <div className="w-full bg-gray-200 rounded h-3">
          <div className="bg-red-500 h-3 rounded" style={{width: `${(hp/maxHp)*100}%`}} />
        </div>
        <div className="text-xs mt-1">{hp} / {maxHp}</div>
      </div>

      <div className="mt-3 flex items-center space-x-2">
        <div className={`badge ${status === 'Healthy' ? 'badge-success' : 'badge-error'}`}>{status}</div>
      </div>

      <div className="mt-3">
        <div className="font-semibold text-sm">Spell Slots</div>
        <div className="flex space-x-2 mt-2">
          {Object.entries(spellslots).map(([lvl, amt]) => (
            <div key={lvl} className="badge badge-outline">Lv {lvl}: {amt}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
