import React, { useState, useRef, useEffect } from 'react'

const DEFAULT_ATTRIBUTES = { STR:10, DEX:10, CON:10, INT:10, WIS:10, CHA:10 }

export default function CharacterSheetModal({open, onClose}){
  const [renderError, setRenderError] = useState(null)
  const [tab, setTab] = useState('sheet')
  const ref = useRef(null)
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  // sheet state
  const [name, setName] = useState('')
  const [race, setRace] = useState('')
  const [className, setClassName] = useState('')
  const [level, setLevel] = useState(1)
  const [maxHp, setMaxHp] = useState(10)
  const [attributes, setAttributes] = useState(DEFAULT_ATTRIBUTES)
  const [skills, setSkills] = useState({})
  const [skillVals, setSkillVals] = useState({})
  const [inventory, setInventory] = useState([])
  const [portrait, setPortrait] = useState('') // data URL or external URL

  useEffect(()=>{
    if (!open) return
    function onKey(e){ if (e.key === 'Escape') onClose && onClose() }
    window.addEventListener('keydown', onKey)
    return ()=> window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(()=>{
    if (typeof window === 'undefined') return
    function onOnline(){ setIsOnline(true) }
    function onOffline(){ setIsOnline(false) }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return ()=>{ window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) }
  }, [])

  // outside click to close
  useEffect(()=>{
    function onDocMouse(e){
      if (!ref.current) return
      if (open && !ref.current.contains(e.target)) onClose && onClose()
    }
    document.addEventListener('mousedown', onDocMouse)
    return ()=> document.removeEventListener('mousedown', onDocMouse)
  }, [open, onClose])

  // load saved
  useEffect(()=>{
    if (!open) return
    try{
      const raw = localStorage.getItem('npcchatter:character')
      if (raw){
        const s = JSON.parse(raw)
        setName(s.name || '')
        setRace(s.race || '')
        setClassName(s.class || '')
        setLevel(s.level || 1)
        setMaxHp(s.maxHp || 10)
        setAttributes(Object.assign({}, DEFAULT_ATTRIBUTES, s.attributes || {}))
        setSkills(s.skills || {})
  setSkillVals(s.skillScores || s.skillVals || {})
        setInventory(s.inventory || [])
        setPortrait(s.portrait || '')
      }
    }catch(e){
      console.error('Failed to load character from localStorage', e)
    }
  }, [open])

  function updateAttribute(key, val){
    setAttributes(a => ({...a, [key]: Number(val) || 0}))
  }

  function toggleSkill(name){
    setSkills(s => ({...s, [name]: !s[name]}))
  }

  function setSkillVal(name, val){
    setSkillVals(s => ({...s, [name]: Number(val) || 0}))
  }

  function addInventory(item){
    if (!item) return
    setInventory(inv => [...inv, item])
  }

  function removeInventory(idx){
    setInventory(inv => inv.filter((_,i)=>i!==idx))
  }

  function onPortraitFile(e){
    const f = e.target.files && e.target.files[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = ()=> setPortrait(reader.result)
    reader.readAsDataURL(f)
  }

  async function save(){
    try{
      const sheet = {
        name: name || 'Unnamed',
        race, class: className, level: Number(level) || 1,
        maxHp: Number(maxHp) || 0,
  attributes, skills, skillScores: skillVals, inventory, portrait
      }
      // persist to server if possible, otherwise localStorage
      try{
        const clientMod = await import('../../../api/client')
        const client = clientMod.default
        const active = typeof window !== 'undefined' ? localStorage.getItem('activeCampaign') : null
        if (active){
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

  try{
    return (
      <div className="fixed inset-0 bg-black/50 flex items-start md:items-center justify-center z-50 overflow-auto py-8">
        <div ref={ref} className="bg-base-100 rounded shadow-lg w-11/12 max-w-4xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-lg">Character Sheet</h3>
            <div className="space-x-2">
              <button className={`btn btn-sm ${tab==='sheet'?'btn-primary':'btn-ghost'}`} onClick={()=>setTab('sheet')}>SHEET</button>
              <button className={`btn btn-sm ${tab==='attributes'?'btn-primary':'btn-ghost'}`} onClick={()=>setTab('attributes')}>ATTRIBUTES</button>
              <button className={`btn btn-sm ${tab==='skills'?'btn-primary':'btn-ghost'}`} onClick={()=>setTab('skills')}>SKILLS</button>
              <button className={`btn btn-sm ${tab==='inventory'?'btn-primary':'btn-ghost'}`} onClick={()=>setTab('inventory')}>INVENTORY</button>
              <button className={`btn btn-sm ${tab==='portrait'?'btn-primary':'btn-ghost'}`} onClick={()=>setTab('portrait')}>PORTRAIT</button>
            </div>
          </div>

          {renderError && <div className="mb-2 text-sm text-error">{renderError}</div>}

          {!isOnline && (
            <div className="mb-2 p-2 bg-yellow-800 text-yellow-50 rounded">You are offline — changes will be saved locally and synced when back online.</div>
          )}

          <div className="max-h-[60vh] overflow-auto p-2">
            {tab === 'sheet' && (
              <div className="md:flex md:space-x-6">
                <div className="md:w-1/3 space-y-4">
                  <div className="border rounded p-3 bg-neutral-900/10">
                    <div className="mb-2 text-sm font-semibold">Portrait</div>
                    <div className="flex flex-col items-center">
                      <div className="w-40 h-40 border rounded overflow-hidden bg-neutral-900/20 flex items-center justify-center mb-3">
                        {portrait ? (
                          <img src={portrait} alt="portrait" className="object-cover w-full h-full" />
                        ) : (
                          <div className="text-sm text-muted">No portrait</div>
                        )}
                      </div>
                      <input type="file" accept="image/*" onChange={onPortraitFile} className="mb-2" />
                      <button className="btn btn-sm" onClick={()=>setPortrait(`https://api.dicebear.com/6.x/avataaars/svg?seed=${encodeURIComponent(name||Date.now())}`)}>Generate</button>
                    </div>
                  </div>

                  <div className="border rounded p-3 bg-neutral-900/10">
                    <div className="text-sm font-semibold mb-2">Core</div>
                    <label className="label"><span className="label-text">Name</span></label>
                    <input className="input w-full bg-neutral-800 border border-neutral-600 text-white placeholder:text-neutral-400 placeholder:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/50 mb-2" value={name} onChange={e=>setName(e.target.value)} placeholder="Character name" />
                    <label className="label"><span className="label-text">Race</span></label>
                    <input className="input w-full bg-neutral-800 border border-neutral-600 text-white placeholder:text-neutral-400 placeholder:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/50 mb-2" value={race} onChange={e=>setRace(e.target.value)} placeholder="Race" />
                    <label className="label"><span className="label-text">Class</span></label>
                    <input className="input w-full bg-neutral-800 border border-neutral-600 text-white placeholder:text-neutral-400 placeholder:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/50 mb-2" value={className} onChange={e=>setClassName(e.target.value)} placeholder="Class" />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="label"><span className="label-text">Level</span></label>
                        <input type="number" className="input w-full bg-neutral-800 border border-neutral-600 text-white focus:outline-none focus:ring-2 focus:ring-primary/50" value={level} onChange={e=>setLevel(e.target.value)} />
                      </div>
                      <div>
                        <label className="label"><span className="label-text">Max HP</span></label>
                        <input type="number" className="input w-full bg-neutral-800 border border-neutral-600 text-white focus:outline-none focus:ring-2 focus:ring-primary/50" value={maxHp} onChange={e=>setMaxHp(e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div className="border rounded p-3 bg-neutral-900/10">
                    <div className="text-sm font-semibold mb-2">Attributes</div>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.keys(attributes).map(k=> (
                        <div key={k} className="p-2 border rounded bg-neutral-900/20 text-center">
                          <div className="text-xs font-semibold mb-1">{k}</div>
                          <input type="number" className="input input-sm w-full bg-neutral-800 border border-neutral-600 text-white focus:outline-none focus:ring-2 focus:ring-primary/50" value={attributes[k]} onChange={e=>updateAttribute(k, e.target.value)} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="md:flex-1 space-y-4">
                  <div className="border rounded p-3 bg-neutral-900/10">
                      <div className="text-sm font-semibold mb-2">Skills</div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {['Acrobatics','Animal Handling','Arcana','Athletics','Deception','History','Insight','Intimidation','Investigation','Medicine','Nature','Perception','Performance','Persuasion','Religion','Sleight of Hand','Stealth','Survival'].map(s=> (
                          <div key={s} className="p-2 border rounded flex items-center justify-between">
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input type="checkbox" checked={!!skills[s]} onChange={()=>toggleSkill(s)} className="form-checkbox h-4 w-4 text-primary" />
                              <span className="text-sm">{s}</span>
                            </label>
                            <input type="number" className="input input-sm w-16 bg-neutral-800 border border-neutral-600 text-white" value={skillVals[s] || 0} onChange={e=>setSkillVal(s, e.target.value)} />
                          </div>
                        ))}
                      </div>
                  </div>

                  {/* Inventory moved to its own tab per request */}
                </div>
              </div>
            )}

            {/* keep the other tabs accessible if user switches away from sheet */}
            {tab === 'attributes' && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.keys(attributes).map(k=> (
                  <div key={k} className="p-2 border rounded bg-neutral-900/20">
                    <div className="text-sm font-semibold">{k}</div>
                    <input type="number" className="input input-sm w-full mt-2 bg-neutral-800 border border-neutral-600 text-white focus:outline-none focus:ring-2 focus:ring-primary/50" value={attributes[k]} onChange={e=>updateAttribute(k, e.target.value)} />
                  </div>
                ))}
              </div>
            )}

            {tab === 'skills' && (
              <div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {['Acrobatics','Animal Handling','Arcana','Athletics','Deception','History','Insight','Intimidation','Investigation','Medicine','Nature','Perception','Performance','Persuasion','Religion','Sleight of Hand','Stealth','Survival'].map(s=> (
                    <div key={s} className="p-2 border rounded flex items-center justify-between">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" checked={!!skills[s]} onChange={()=>toggleSkill(s)} className="form-checkbox h-4 w-4 text-primary" />
                        <span className="text-sm">{s}</span>
                      </label>
                      <input type="number" className="input input-sm w-16 bg-neutral-800 border border-neutral-600 text-white" value={skillVals[s] || 0} onChange={e=>setSkillVal(s, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'inventory' && (
              <div>
                <InventoryEditor items={inventory} onAdd={addInventory} onRemove={removeInventory} />
              </div>
            )}

            {tab === 'portrait' && (
              <div className="md:flex md:items-start md:space-x-4">
                <div className="md:w-1/3">
                  <div className="mb-2">
                    <label className="label"><span className="label-text">Upload portrait</span></label>
                    <input type="file" accept="image/*" onChange={onPortraitFile} />
                  </div>
                  <div className="mb-2">
                    <label className="label"><span className="label-text">Or generate</span></label>
                    <button className="btn btn-sm" onClick={()=>setPortrait(`https://api.dicebear.com/6.x/avataaars/svg?seed=${encodeURIComponent(name||Date.now())}`)}>Generate avatar</button>
                  </div>
                </div>
                <div className="mt-4 md:mt-0 md:flex-1">
                  <div className="border rounded p-2 h-48 w-full flex items-center justify-center bg-neutral-900/20">
                    {portrait ? (
                      <img src={portrait} alt="portrait" className="max-h-44 max-w-full object-contain" />
                    ) : (
                      <div className="text-sm text-muted">No portrait selected</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2 mt-4">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={!isOnline} title={!isOnline? 'Disabled while offline' : ''}>{isOnline ? 'Save' : 'Save (offline disabled)'}</button>
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

function InventoryEditor({items, onAdd, onRemove}){
  const [val, setVal] = useState('')
  return (
    <div>
      <div className="mb-2 flex space-x-2">
        <input className="input flex-1 bg-neutral-800 border border-neutral-600 text-white placeholder:text-neutral-400 placeholder:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/50" value={val} onChange={e=>setVal(e.target.value)} placeholder="New inventory item" />
        <button className="btn" onClick={()=>{ onAdd(val); setVal('') }}>Add</button>
      </div>
      <ul className="space-y-2">
        {items.map((it, idx)=> (
          <li key={idx} className="flex items-center justify-between p-2 border rounded">
            <span>{it}</span>
            <button className="btn btn-sm btn-ghost" onClick={()=>onRemove(idx)}>Remove</button>
          </li>
        ))}
        {items.length===0 && <li className="text-sm text-muted">No items</li>}
      </ul>
    </div>
  )
}
