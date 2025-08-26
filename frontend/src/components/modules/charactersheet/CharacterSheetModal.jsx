import React, { useState } from 'react'

export default function CharacterSheetModal({open, onClose}){
  const [name, setName] = useState('')
  const [maxHp, setMaxHp] = useState(10)
  const [renderError, setRenderError] = useState(null)

  React.useEffect(()=>{
    if (!open) return
    function onKey(e){ if (e.key === 'Escape') onClose && onClose() }
    window.addEventListener('keydown', onKey)
    return ()=> window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Load existing on open
  React.useEffect(()=>{
    if (!open) return
    try{
      const raw = localStorage.getItem('npcchatter:character')
      if (raw){
        const s = JSON.parse(raw)
        setName(s.name || '')
        setMaxHp(s.maxHp || 10)
      }
    }catch(e){
      console.error('Failed to load character from localStorage', e)
    }
  }, [open])

  async function save(){
    try{
      const portrait = `https://api.dicebear.com/6.x/avataaars/svg?seed=${encodeURIComponent(name || (Date.now()))}`
      const sheet = { name: name || 'Unnamed', maxHp: Number(maxHp) || 0, portrait }
      // Try saving to server if user is authenticated
      try{
        const clientMod = await import('../../../api/client')
        const client = clientMod.default
        // Persist as a campaign-scoped character when active campaign is present
        const active = typeof window !== 'undefined' ? localStorage.getItem('activeCampaign') : null
        if (active){
          // find campaign id
          const camps = await client.get('/campaigns')
          const found = Array.isArray(camps) ? camps.find(c => c.name === active || String(c.id) === String(active)) : null
          if (found){
            await client.post(`/campaigns/${found.id}/characters`, sheet)
          } else {
            await client.put('/users/me/character', sheet)
          }
        } else {
          await client.put('/users/me/character', sheet)
        }
      }catch(e){
        // ignore server errors and fallback to localStorage
        console.debug('Could not save character to server, falling back to localStorage', e)
        localStorage.setItem('npcchatter:character', JSON.stringify(sheet))
      }
      window.dispatchEvent(new CustomEvent('npcchatter:character-updated', {detail: sheet}))
      onClose && onClose()
    }catch(e){
      console.error('Failed to save character', e)
      setRenderError('Failed to save character')
    }
  }

  if (!open) return null

  // Defensive render so an exception here won't blank the entire app
  try{
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-base-100 rounded shadow-lg w-96 p-4">
          <h3 className="font-semibold mb-2">Character Sheet</h3>
          {renderError && <div className="mb-2 text-sm text-error">{renderError}</div>}
          <div className="mb-2">
            <label className="label"><span className="label-text">Name</span></label>
            <input className="input input-sm w-full" value={name} onChange={e=>setName(e.target.value)} placeholder="Character name" />
          </div>

          <div className="mb-2">
            <label className="label"><span className="label-text">Max HP</span></label>
            <input type="number" className="input input-sm w-full" value={maxHp} onChange={e=>setMaxHp(e.target.value)} />
          </div>

          <div className="flex justify-end space-x-2 mt-4">
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={save}>Save</button>
          </div>
        </div>
      </div>
    )
  }catch(e){
    console.error('CharacterSheetModal render error', e)
    setRenderError('An unexpected error occurred')
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-base-100 rounded shadow-lg w-96 p-4">
          <h3 className="font-semibold mb-2">Character Sheet</h3>
          <div className="text-sm text-error">An error occurred rendering the character sheet. Check console.</div>
          <div className="flex justify-end mt-4">
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    )
  }
}
