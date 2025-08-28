import React from 'react'
import client from '../../api/client'

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
  const [sheet, setSheet] = React.useState(null)
  // stable seed based on the token payload; memoize so Date.now() isn't called each render
  const seed = React.useMemo(() => payload?.email || payload?.sub || String(Date.now()), [payload])
  const avatar = React.useMemo(() => sheet?.portrait || `https://api.dicebear.com/6.x/avataaars/svg?seed=${encodeURIComponent(seed)}`, [sheet, seed])

  React.useEffect(()=>{
    async function load(){
      try{
        const active = typeof window !== 'undefined' ? localStorage.getItem('activeCampaign') : null
        if (!active) return
  // use static client import
        // find campaign id
        const camps = await client.get('/campaigns')
        const found = Array.isArray(camps) ? camps.find(c => c.name === active || String(c.id) === String(active)) : null
        if (found){
          // fetch my character for campaign
          const chars = await client.get(`/campaigns/${found.id}/characters`)
          // find char for current user (token sub)
          const myChar = Array.isArray(chars) ? chars.find(ch=> String(ch.user_id) === String(payload?.sub)) : null
          if (myChar) setSheet(myChar)
        }
      }catch(e){
        // ignore load errors
      }
    }
    load()
    function onUpdate(){ load() }
    window.addEventListener('npcchatter:character-updated', onUpdate)
    return ()=> window.removeEventListener('npcchatter:character-updated', onUpdate)
  }, [])

  const name = React.useMemo(() => sheet?.name || payload?.username || pickName(seed), [sheet, payload, seed])
  const maxHp = Number(sheet?.maxHp ?? 40)
  // prefer persisted currentHp if present, otherwise use a stable fallback (half of max)
  const hp = Number(sheet?.currentHp ?? Math.max(1, Math.floor(maxHp / 2)))
  // prefer persisted status/conditions if present, otherwise default to Healthy
  const status = sheet?.status || 'Healthy'
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

      {sheet && sheet.attributes && (
        <div className="mt-3">
          <div className="text-sm font-semibold mb-2">Attributes</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {Object.entries(sheet.attributes).map(([k,v]) => (
              <div key={k} className="p-1 border rounded bg-neutral-100/50 text-center">
                <div className="font-medium">{k}</div>
                <div className="text-sm">{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sheet && sheet.skillScores && (
        <div className="mt-3">
          <div className="text-sm font-semibold mb-2">Skills</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(sheet.skillScores).slice(0,8).map(([s,val]) => (
              <div key={s} className="badge badge-outline">{s}: {val}</div>
            ))}
          </div>
        </div>
      )}

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
