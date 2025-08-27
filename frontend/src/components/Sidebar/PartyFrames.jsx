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
  const [members, setMembers] = React.useState([])

  React.useEffect(()=>{
    async function load(){
      try{
        const active = typeof window !== 'undefined' ? localStorage.getItem('activeCampaign') : null
        if (!active) return
        const clientMod = await import('../../api/client')
        const client = clientMod.default
        const camps = await client.get('/campaigns')
        const found = Array.isArray(camps) ? camps.find(c => c.name === active || String(c.id) === String(active)) : null
        if (found){
          const chars = await client.get(`/campaigns/${found.id}/characters`)
          setMembers(Array.isArray(chars) ? chars : [])
        }
      }catch(e){
        // ignore
      }
    }
    load()
    function onUpdate(){ load() }
    window.addEventListener('npcchatter:character-updated', onUpdate)
    return ()=> window.removeEventListener('npcchatter:character-updated', onUpdate)
  }, [])

  return (
    <div className="card bg-base-200 p-3">
      <div className="space-y-2">
        {members.map(ch => {
          const maxHp = ch.maxHp || 40
          const hp = Math.floor(Math.random() * (maxHp - 5)) + 5
          const pct = Math.max(0, Math.min(100, Math.floor((hp / maxHp) * 100)))
          return (
            <div key={ch.id} className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full overflow-hidden border">
                <img src={ch.portrait || avatarFor(ch.name)} alt={ch.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline justify-between">
                  <div className="font-medium">{ch.name || 'Unnamed'}</div>
                  <div className="text-xs text-muted">{hp}/{maxHp}</div>
                </div>
                <div className="w-full bg-gray-200 rounded h-2 mt-1 overflow-hidden">
                  <div className="bg-red-500 h-2" style={{width: `${pct}%`}} />
                </div>
                {ch.attributes && (
                  <div className="mt-2 text-xs grid grid-cols-6 gap-1">
                    {Object.entries(ch.attributes).map(([k,v]) => (
                      <div key={k} className="text-center border rounded py-1">{k}: {v}</div>
                    ))}
                  </div>
                )}
                {ch.skillScores && (
                  <div className="mt-2 text-xs flex flex-wrap gap-1">
                    {Object.entries(ch.skillScores).slice(0,6).map(([s,v]) => (
                      <div key={s} className="badge badge-outline">{s}: {v}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
