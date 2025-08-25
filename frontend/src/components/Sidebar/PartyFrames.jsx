import React from 'react'

const NAMES = [
  'Arin Brightwood',
  'Borin Oakshield',
  'Calia Windrunner',
  'Dorian Nightbreeze'
]

function avatarFor(seed){
  return `https://api.dicebear.com/6.x/avataaars/svg?seed=${encodeURIComponent(seed)}`
}

export default function PartyFrames(){
  return (
    <div className="card bg-base-200 p-3">
      <div className="font-semibold mb-2">Party</div>
      <div className="space-y-2">
        {NAMES.map((n, i) => (
          // mock hp values per member
          (() => {
            const maxHp = 40
            const hp = Math.floor(Math.random() * (maxHp - 5)) + 5
            const pct = Math.max(0, Math.min(100, Math.floor((hp / maxHp) * 100)))
            return (
              <div key={n} className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border">
                  <img src={avatarFor(n)} alt={n} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between">
                    <div className="font-medium">{n}</div>
                    <div className="text-xs text-muted">{hp}/{maxHp}</div>
                  </div>
                  <div className="w-full bg-gray-200 rounded h-2 mt-1 overflow-hidden">
                    <div className="bg-red-500 h-2" style={{width: `${pct}%`}} />
                  </div>
                </div>
              </div>
            )
          })()
        ))}
      </div>
    </div>
  )
}
