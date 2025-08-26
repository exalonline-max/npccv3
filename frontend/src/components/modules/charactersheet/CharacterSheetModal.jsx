import React, { useState } from 'react'

export default function CharacterSheetModal({open, onClose}){
  const [name, setName] = useState('')
  const [maxHp, setMaxHp] = useState(10)

  React.useEffect(()=>{
    if (!open) return
    function onKey(e){ if (e.key === 'Escape') onClose && onClose() }
    window.addEventListener('keydown', onKey)
    return ()=> window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  function save(){
    // store locally for now; we'll add server persistence later
    const sheet = { name: name || 'Unnamed', maxHp: Number(maxHp) || 0 }
    localStorage.setItem('npcchatter:character', JSON.stringify(sheet))
    window.dispatchEvent(new CustomEvent('npcchatter:character-updated', {detail: sheet}))
    onClose && onClose()
  }

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
    }catch(e){}
  }, [open])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-base-100 rounded shadow-lg w-96 p-4">
        <h3 className="font-semibold mb-2">Character Sheet</h3>
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
}
