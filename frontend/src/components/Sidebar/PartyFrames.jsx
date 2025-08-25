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
          <div key={n} className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full overflow-hidden border">
              <img src={avatarFor(n)} alt={n} className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="font-medium">{n}</div>
              <div className="text-xs text-muted">HP {Math.floor(Math.random()*30)+5}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
