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
  const [currentHp, setCurrentHp] = useState('')
  const [tempHp, setTempHp] = useState('')
  const [attributes, setAttributes] = useState(DEFAULT_ATTRIBUTES)
  const [skills, setSkills] = useState({})
  const [skillVals, setSkillVals] = useState({})
  const [inventory, setInventory] = useState([])
  const [portrait, setPortrait] = useState('') // data URL or external URL
  const [ac, setAc] = useState('')
  const [initiative, setInitiative] = useState('')
  const [speed, setSpeed] = useState('')
  // Other Stats
  const [proficiencyBonus, setProficiencyBonus] = useState(2)
  const [languages, setLanguages] = useState('')

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
        setCurrentHp(s.currentHp || '')
        setTempHp(s.tempHp || '')
        setAttributes(Object.assign({}, DEFAULT_ATTRIBUTES, s.attributes || {}))
        setSkills(s.skills || {})
        setSkillVals(s.skillScores || s.skillVals || {})
        setInventory(s.inventory || [])
        setPortrait(s.portrait || '')
        setAc(s.ac || '')
        setInitiative(s.initiative || '')
        setSpeed(s.speed || '')
        setProficiencyBonus(s.proficiencyBonus || 2)
        setLanguages(s.languages || '')
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
        currentHp, tempHp,
        ac, initiative, speed,
        attributes, skills, skillScores: skillVals, inventory, portrait,
        proficiencyBonus, languages,
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

  // Modal max height for compactness
  try{
    return (
      <div className="fixed inset-0 bg-black/50 flex items-start md:items-center justify-center z-50 overflow-auto py-4">
        <div
          ref={ref}
          className="bg-base-100 rounded shadow-lg w-11/12 max-w-6xl p-4"
          style={{ maxHeight: 1000, overflow: 'auto' }}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-lg">Character Sheet</h3>
            <div className="tabs tabs-boxed">
              <a className={`tab tab-sm ${tab==='sheet'?'tab-active':''}`} onClick={()=>setTab('sheet')}>OVERVIEW</a>
              <a className={`tab tab-sm ${tab==='actions'?'tab-active':''}`} onClick={()=>setTab('actions')}>ACTIONS</a>
              <a className={`tab tab-sm ${tab==='features'?'tab-active':''}`} onClick={()=>setTab('features')}>FEATURES</a>
              <a className={`tab tab-sm ${tab==='inventory'?'tab-active':''}`} onClick={()=>setTab('inventory')}>INVENTORY</a>
            </div>
          </div>

          {renderError && <div className="mb-2 text-sm text-error">{renderError}</div>}

          {!isOnline && (
            <div className="mb-2 p-2 bg-yellow-800 text-yellow-50 rounded">You are offline — changes will be saved locally and synced when back online.</div>
          )}

          <div className="overflow-hidden p-1">
            {tab === 'sheet' && (
              <>
                {/* Character Info and Main Sheet Grid */}
                <div className="grid grid-cols-[auto_1fr_auto] gap-6 mb-4 items-start">
                  {/* Left Side: Portrait and IDENTITY */}
                  <div className="flex flex-col gap-4 min-w-[140px] w-[180px]">
                    {/* Portrait */}
                    <div className="bg-base-200 rounded p-2 flex flex-col items-center section-group">
                      <div className="font-bold uppercase text-[10px] mb-1 w-full text-left">Portrait</div>
                      <div className="flex flex-col items-center gap-2 w-full">
                        {portrait ? (
                          <img
                            src={portrait}
                            alt="Portrait"
                            className="w-24 h-24 object-cover border-2 border-neutral-600 rounded"
                          />
                        ) : (
                          <div className="w-24 h-24 bg-neutral-800 border-2 border-neutral-600 rounded flex items-center justify-center text-neutral-400 text-xs">
                            No Image
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="file-input file-input-xs w-full"
                          onChange={onPortraitFile}
                        />
                        <button className="btn btn-xs btn-secondary w-full">Generate</button>
                      </div>
                    </div>
                    {/* IDENTITY Section */}
                    <div className="bg-base-200 rounded p-2 section-group">
                      <div className="font-bold uppercase text-[10px] mb-2 text-center">IDENTITY</div>
                      <div className="flex flex-col gap-2">
                        <div>
                          <div className="text-[10px] font-bold mb-1 text-left">Name</div>
                          <input type="text" className="input input-xs w-full text-white bg-neutral-800 border border-neutral-600 py-1" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold mb-1 text-left">Class</div>
                          <input type="text" className="input input-xs w-full text-white bg-neutral-800 border border-neutral-600 py-1" value={className} onChange={e => setClassName(e.target.value)} />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold mb-1 text-left">Level</div>
                          <input type="number" min="1" className="input input-xs w-full text-center bg-neutral-800 border border-neutral-600 text-white py-1" value={level} onChange={e => setLevel(Number(e.target.value))} />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold mb-1 text-left">Background</div>
                          <input type="text" className="input input-xs w-full text-white bg-neutral-800 border border-neutral-600 py-1" />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold mb-1 text-left">Race</div>
                          <input type="text" className="input input-xs w-full text-white bg-neutral-800 border border-neutral-600 py-1" value={race} onChange={e => setRace(e.target.value)} />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold mb-1 text-left">Alignment</div>
                          <input type="text" className="input input-xs w-full text-white bg-neutral-800 border border-neutral-600 py-1" />
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Main Sheet */}
                  <div className="flex flex-col gap-4 w-full">
                    {/* Main Sheet Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Left: Attributes & Saves */}
                      <div className="flex flex-col gap-4">
                        {/* Attributes & Saves */}
                        <div className="bg-base-200 rounded p-2 mb-4 section-group">
                          <div className="text-[10px] font-bold uppercase mb-1 text-center">Attributes</div>
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            {Object.keys(attributes).map(k => (
                              <div key={k} className="p-1 border rounded bg-neutral-900/30 text-center">
                                <div className="text-[10px] font-bold text-center">{k}</div>
                                <div className="text-sm font-mono text-center">{(() => {
                                  const mod = Math.floor((attributes[k] - 10) / 2)
                                  return mod >= 0 ? `+${mod}` : mod
                                })()}</div>
                                <input
                                  type="number"
                                  className="input input-xs w-full text-center bg-neutral-800 border border-neutral-600 text-white py-1"
                                  value={attributes[k]}
                                  onChange={e => updateAttribute(k, e.target.value)}
                                />
                              </div>
                            ))}
                          </div>
                          <div className="font-bold text-[10px] uppercase mb-1 text-center">Saving Throws</div>
                          <div className="flex flex-col gap-1">
                            {['Strength','Dexterity','Constitution','Intelligence','Wisdom','Charisma'].map((attr, i) => (
                              <div key={i} className="flex items-center justify-between text-[10px]">
                                <label className="flex items-center gap-1 text-left">
                                  <input type="checkbox" className="checkbox checkbox-xs" checked={!!skills[attr]} onChange={() => toggleSkill(attr)} />
                                  {attr}
                                </label>
                                <span className="text-center">{Math.floor((attributes[attr.slice(0,3).toUpperCase()] - 10) / 2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      {/* Right: Core Stats & Health */}
                      <div className="flex flex-col gap-4">
                        {/* Core Stats */}
                        <div className="bg-base-200 rounded p-2 mb-4 section-group">
                          <div className="text-[10px] font-bold uppercase mb-1 text-center">Core Stats</div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="text-center">
                              <div className="text-[10px] text-left">AC</div>
                              <div className="p-0.5 border rounded bg-neutral-900/30">
                                <input type="number" className="input input-xs w-full text-center bg-neutral-800 border-none text-white py-1 focus:ring-0" style={{boxShadow: 'none'}} value={ac} onChange={e => setAc(e.target.value)} />
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-[10px] flex items-center justify-center gap-1 text-left">
                                Initiative
                                <span
                                  className="tooltip ml-1 cursor-help"
                                  data-tip="Initiative = DEX Modifier + Bonuses"
                                >&#9432;</span>
                              </div>
                              <div className="p-0.5 border rounded bg-neutral-900/30">
                                <input type="number" className="input input-xs w-full text-center bg-neutral-800 border-none text-white py-1 focus:ring-0" style={{boxShadow: 'none'}} value={initiative} onChange={e => setInitiative(e.target.value)} />
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-[10px] text-left">Speed</div>
                              <div className="p-0.5 border rounded bg-neutral-900/30">
                                <input type="number" className="input input-xs w-full text-center bg-neutral-800 border-none text-white py-1 focus:ring-0" style={{boxShadow: 'none'}} value={speed} onChange={e => setSpeed(e.target.value)} />
                              </div>
                            </div>
                          </div>
                        </div>
                        {/* Health (includes Hit Dice and Death Saves) */}
                        <div className="bg-base-200 rounded p-2 mb-4 section-group">
                          <div className="text-[10px] font-bold uppercase text-center mb-1">Health</div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="text-center">
                              <div className="text-[10px] text-left">Current</div>
                              <div className="p-0.5 border rounded bg-neutral-900/30">
                                <input type="number" className="input input-xs w-full text-center bg-neutral-800 border-none text-white py-1 focus:ring-0" style={{boxShadow: 'none'}} value={currentHp} onChange={e => setCurrentHp(e.target.value)} />
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-[10px] text-left">Max</div>
                              <div className="p-0.5 border rounded bg-neutral-900/30">
                                <input type="number" className="input input-xs w-full text-center bg-neutral-800 border-none text-white py-1 focus:ring-0" style={{boxShadow: 'none'}} value={maxHp} onChange={e => setMaxHp(e.target.value)} />
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-[10px] text-left">Temp</div>
                              <div className="p-0.5 border rounded bg-neutral-900/30">
                                <input type="number" className="input input-xs w-full text-center bg-neutral-800 border-none text-white py-1 focus:ring-0" style={{boxShadow: 'none'}} value={tempHp} onChange={e => setTempHp(e.target.value)} />
                              </div>
                            </div>
                          </div>
                          {/* Hit Dice */}
                          <div className="mt-2">
                            <div className="text-[10px] font-bold mb-1 text-left">Hit Dice</div>
                            <input type="text" className="input input-xs w-full text-white bg-neutral-800 border border-neutral-600 py-1" />
                          </div>
                          {/* Death Saves */}
                          <div className="mt-2">
                            <div className="text-[10px] font-bold mb-1 text-left">Death Saves</div>
                            <div className="flex justify-between">
                              <span>✓✓✓</span>
                              <span>✗✗✗</span>
                            </div>
                          </div>
                        </div>
                        {/* Other Stats */}
                        <div className="bg-base-200 rounded p-2 mb-4 section-group">
                          <div className="text-[10px] font-bold uppercase text-center mb-1">Other Stats</div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="text-center">
                              <div className="text-[10px] text-left">Prof. Bonus</div>
                              <div className="p-0.5 border rounded bg-neutral-900/30">
                                <input
                                  type="number"
                                  className="input input-xs w-full text-center bg-neutral-800 border-none text-white py-1 focus:ring-0"
                                  style={{boxShadow: 'none'}}
                                  value={proficiencyBonus}
                                  onChange={e => setProficiencyBonus(Number(e.target.value))}
                                />
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-[10px] flex items-center justify-center gap-1 text-left">
                                Passive Perception
                                <span
                                  className="tooltip ml-1 cursor-help"
                                  data-tip="Passive Perception = 10 + WIS Modifier + Proficiency (if proficient)"
                                >&#9432;</span>
                              </div>
                              <div className="p-0.5 border rounded bg-neutral-900/30">
                                <div className="input input-xs w-full text-center bg-neutral-800 border-none text-white py-1 focus:ring-0" style={{boxShadow: 'none', pointerEvents: 'none'}}>
                                  {10 + Math.floor((attributes.WIS - 10) / 2) + (skills.Perception ? proficiencyBonus : 0)}
                                </div>
                              </div>
                            </div>
                            <div className="text-center col-span-3">
                              <div className="text-[10px] text-left">Languages</div>
                              <input
                                type="text"
                                className="input input-xs w-full text-white bg-neutral-800 border border-neutral-600 py-1"
                                value={languages}
                                onChange={e => setLanguages(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Skills Section: vertical column to far right */}
                  <div className="flex flex-col gap-4 min-w-[240px] max-w-[260px]">
                    <div className="bg-base-200 rounded p-2 h-full section-group">
                      <div className="text-[10px] font-bold uppercase mb-1 text-center">Skills</div>
                      <div className="flex flex-col gap-1">
                        {[
                          'Acrobatics','Animal Handling','Arcana','Athletics','Deception','History',
                          'Insight','Intimidation','Investigation','Medicine','Nature','Perception',
                          'Performance','Persuasion','Religion','Sleight of Hand','Stealth','Survival'
                        ].map(skill => {
                          const abilityMap = {
                            Acrobatics: 'DEX', 'Animal Handling': 'WIS', Arcana: 'INT', Athletics: 'STR',
                            Deception: 'CHA', History: 'INT', Insight: 'WIS', Intimidation: 'CHA',
                            Investigation: 'INT', Medicine: 'WIS', Nature: 'INT', Perception: 'WIS',
                            Performance: 'CHA', Persuasion: 'CHA', Religion: 'INT', 'Sleight of Hand': 'DEX',
                            Stealth: 'DEX', Survival: 'WIS'
                          }
                          const attr = abilityMap[skill] || 'INT'
                          const mod = Math.floor((attributes[attr] || 10 - 10) / 2)
                          const prof = skills[skill] ? 2 : 0
                          const total = mod + prof
                          return (
                            <div key={skill} className="flex items-center gap-1 text-[10px] mb-1">
                              <label className="flex items-center gap-1 text-left min-w-[100px]">
                                <input
                                  type="checkbox"
                                  className="checkbox checkbox-xs"
                                  checked={!!skills[skill]}
                                  onChange={() => toggleSkill(skill)}
                                  style={{ minWidth: 16, minHeight: 16 }}
                                />
                                {skill}
                              </label>
                              <span className="flex-1"></span>
                              <span className="w-8 text-right font-mono">{total >= 0 ? '+' : ''}{total}</span>
                              <input
                                type="number"
                                className="input input-xs w-14 text-center bg-neutral-800 border border-neutral-600 text-white py-1 ml-2"
                                value={skillVals[skill] || 0}
                                onChange={e => setSkillVal(skill, e.target.value)}
                                style={{ minWidth: 40 }}
                              />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
                
              </>
            )}

            {tab === 'actions' && (
              <div className="text-sm text-muted italic">You can define attacks and actions here.</div>
            )}

            {tab === 'features' && (
              <div className="text-sm text-muted italic">Features & traits will be listed here.</div>
            )}

            {tab === 'inventory' && (
              <div>
                <InventoryEditor items={inventory} onAdd={addInventory} onRemove={removeInventory} />
              </div>
            )}
          </div>

          <div className="mt-2 pt-2 border-t bg-base-100 sticky bottom-0 left-0 right-0">
            <div className="flex justify-end space-x-3 p-2">
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
              <button className={`btn btn-primary btn-sm ${!isOnline? 'opacity-60 cursor-not-allowed' : ''}`} onClick={save} disabled={!isOnline} title={!isOnline? 'Disabled while offline' : ''}>{isOnline ? 'Save' : 'Save (offline disabled)'}</button>
            </div>
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

// Add section-group styling
// You may want to add this CSS to your global stylesheet or tailwind config:
// .section-group { border: 1px solid #444; border-radius: 0.5rem; padding: 0.75rem; margin-bottom: 0.5rem; background: rgba(38,38,38,0.07);}