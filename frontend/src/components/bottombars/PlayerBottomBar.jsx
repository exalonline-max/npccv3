import React, { useState, useEffect, useRef } from 'react'

// Player-bottom bar: full-width fixed bar that aligns its inner content to the page <main>
export default function PlayerBottomBar(){
  const [activeTab, setActiveTab] = useState('Character')
  const tabs = ['Character','Actions','Inventory']
  const [mainLeft, setMainLeft] = useState(null)
  const [mainWidth, setMainWidth] = useState(null)
  const alignRef = useRef(null)

  // keep the inner panel aligned to the main element (so the bar lines up with page content)
  useEffect(()=>{
    function recomputeMain(){
      const main = document.querySelector('main')
      if (main){
        const rect = main.getBoundingClientRect()
        setMainLeft(`${rect.left}px`)
        setMainWidth(`${rect.width}px`)
      } else {
        setMainLeft(null)
        setMainWidth(null)
      }
    }
    recomputeMain()
    let ro = null
    if (window.ResizeObserver){
      ro = new ResizeObserver(()=> recomputeMain())
      const main = document.querySelector('main')
      if (main) ro.observe(main)
    }
    window.addEventListener('resize', recomputeMain)
    return ()=>{
      window.removeEventListener('resize', recomputeMain)
      if (ro) ro.disconnect()
    }
  },[])

  return (
    <div id="player-bottom-bar" className="fixed left-0 right-0 bottom-0 z-40">
      <div className="absolute -top-6 left-0 right-0 flex justify-center gap-2">
        {tabs.map(t => (
          <button
            key={t}
            className={`px-3 py-1 rounded-t-md border border-b-0 bg-base-200 text-xs ${activeTab===t ? 'bg-base-100 font-semibold border-primary' : 'opacity-70'}`}
            onClick={()=>setActiveTab(t)}
          >{t}</button>
        ))}
      </div>

      <div className="bg-base-100 border-t p-2 h-auto min-h-24 flex items-stretch">
        <div ref={alignRef} className="px-2 flex-1 overflow-hidden" style={mainLeft ? {position:'absolute', left: mainLeft, width: mainWidth} : {width: '100%'}}>
          <div className="h-full overflow-hidden rounded-md border bg-base-200/20 p-2 text-[10px]">
            {activeTab === 'Character' && <CharacterTab />}
            {activeTab === 'Actions' && <ActionsTab />}
            {activeTab === 'Inventory' && <InventoryTab />}
          </div>
        </div>
      </div>
    </div>
  )
}

function CharacterTab(){
  const skills = [
    'Acrobatics','Animal Handling','Arcana','Athletics','Deception','History',
    'Insight','Intimidation','Investigation','Medicine','Nature','Perception',
    'Performance','Persuasion','Religion','Sleight of Hand','Stealth','Survival'
  ];

  const abilities = [
    ['STR',10],['DEX',18],['CON',14],['INT',12],['WIS',13],['CHA',8]
  ];

  function abilityMod(score){ return Math.floor((score - 10) / 2) }
  const profBonus = 3
  const saveProfs = new Set(['Str','Con'])

  const skillMap = {
    'Acrobatics':'DEX','Animal Handling':'WIS','Arcana':'INT','Athletics':'STR','Deception':'CHA','History':'INT',
    'Insight':'WIS','Intimidation':'CHA','Investigation':'INT','Medicine':'WIS','Nature':'INT','Perception':'WIS',
    'Performance':'CHA','Persuasion':'CHA','Religion':'INT','Sleight of Hand':'DEX','Stealth':'DEX','Survival':'WIS'
  }

  function rollD20(){ return 1 + Math.floor(Math.random()*20) }
  const signed = (n)=> (n>=0? `+${n}` : `${n}`)

  function doRoll(label, modifier){
    const d20 = rollD20()
    const total = d20 + modifier
    window.dispatchEvent(new CustomEvent('npcchatter:roll', {detail: {label, d20, modifier, total, author: 'You'}}))
  }

  return (
    <div className="h-full flex items-stretch gap-3">
      {/* Attributes - 20% */}
      <div className="w-[20%]">
        <div className="grid grid-cols-3 grid-rows-2 gap-1">
          {abilities.map(([abbr, val]) => {
            const mod = abilityMod(val)
            const modLabel = (mod>=0? `+${mod}` : `${mod}`)
            return (
              <button key={abbr} onClick={()=>doRoll(`${abbr} check`, mod)} className="px-2 py-1 rounded border bg-base-200/40 text-[10px] leading-none text-center">
                <div className="opacity-70">{abbr}</div>
                <div className="font-semibold">{val} <span className="opacity-70">({modLabel})</span></div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Prof / Inspiration - 10% */}
      <div className="w-[10%] flex flex-col justify-center gap-1">
        <button className="w-full px-2 py-1 rounded border bg-base-200/40 text-[10px] text-left">
          <span className="opacity-70 mr-1">Prof</span>
          <span className="font-semibold">+{profBonus}</span>
        </button>
        <button className="w-full px-2 py-1 rounded border bg-base-200/40 text-[10px] text-left">
          <span className="opacity-70 mr-1">Insp</span>
          <span className="font-semibold">0</span>
        </button>
      </div>

      {/* Saving Throws - 20% */}
      <div className="w-[20%] flex-shrink-0 rounded border bg-base-200/10 p-1">
        <div className="opacity-70 text-[10px] px-1">Saving Throws</div>
        <div className="mt-1 grid grid-cols-3 gap-1">
          {['Str','Dex','Con','Int','Wis','Cha'].map(s => {
            const abil = s.toUpperCase()
            const abilScore = abilities.find(a=>a[0]===abil)[1]
            const base = abilityMod(abilScore)
            const proficient = saveProfs.has(s)
            const total = base + (proficient ? profBonus : 0)
            return (
              <button
                key={s}
                onClick={()=>doRoll(`${s} save`, total)}
                className={`px-1.5 py-1 rounded border text-[10px] leading-none flex items-center justify-between ${proficient ? 'border-primary/70 bg-base-200/40' : 'border-base-300 bg-base-200/30'}`}
                title={`${s} save ${signed(total)} (base ${signed(base)}${proficient ? ` + prof +${profBonus}` : ''})`}
              >
                <span className="uppercase opacity-80">{s}</span>
                <span className="font-semibold">{signed(total)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Skills - 50% (6 cols x 3 rows). Modifier always visible */}
      <div className="w-[50%]">
        <div className="grid grid-cols-6 grid-rows-3 gap-1 text-[10px]">
          {skills.map(s => {
            const abil = skillMap[s] || 'INT'
            const abilScore = abilities.find(a=>a[0]===abil)[1]
            const mod = abilityMod(abilScore)
            const modLabel = (mod>=0? `+${mod}` : `${mod}`)
            return (
              <button key={s} onClick={()=>doRoll(`${s} (${abil})`, mod)} className="px-1 py-0.5 rounded border bg-base-200/40 text-left leading-tight text-[10px]">
                <div className="flex items-center gap-1 min-w-0">
                  <div className="truncate min-w-0">{s}</div>
                  <div className="flex-none opacity-70 ml-1 pl-1">{modLabel}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ActionsTab(){
  return (
    <div className="h-full flex flex-wrap items-center gap-4 overflow-auto text-[10px]">
      <div className="flex items-center gap-2">
        <span className="opacity-70">Attacks</span>
        <span className="px-2 py-1 rounded border bg-base-200/40">Quarterstaff <span className="opacity-70">1d6+2</span></span>
      </div>

      <div className="opacity-30">|</div>

      <div className="flex items-center gap-2">
        <span className="opacity-70">Spells</span>
        <span className="px-2 py-1 rounded border bg-base-200/40">Magic Missile <span className="opacity-70">1d4+1</span></span>
        <span className="px-2 py-1 rounded border bg-base-200/40">Thunderwave <span className="opacity-70">2d8</span></span>
      </div>

      <div className="opacity-30">|</div>
      {/* Expanded attacks and spells - compact buttons for quick use */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="opacity-70">Attacks</span>
          {[
            {name: 'Quarterstaff', dmg: '1d6+2'},
            {name: 'Shortbow', dmg: '1d6+3'},
            {name: 'Dagger', dmg: '1d4+2'},
            {name: 'Greatsword', dmg: '2d6+4'},
            {name: 'Unarmed', dmg: '1'},
          ].map(a => (
            <button key={a.name} className="px-2 py-1 rounded border bg-base-200/40 text-[10px]">{a.name} <span className="opacity-70">{a.dmg}</span></button>
          ))}
        </div>

        <div className="opacity-30">|</div>

        <div className="flex items-center gap-2">
          <span className="opacity-70">Spells</span>
          {[
            {name: 'Magic Missile', note: '1d4+1'},
            {name: 'Thunderwave', note: '2d8'},
            {name: 'Fireball', note: '8d6'},
            {name: 'Cure Wounds', note: '1d8+spell'},
            {name: 'Shield', note: 'AC+5'},
            {name: 'Misty Step', note: 'Teleport'},
            {name: 'Eldritch Blast', note: '1d10'},
          ].map(sp => (
            <button key={sp.name} className="px-2 py-1 rounded border bg-base-200/40 text-[10px]">{sp.name} <span className="opacity-70">{sp.note}</span></button>
          ))}
        </div>
      </div>
    </div>
  )
}

function InventoryTab(){
  return (
    <div className="h-full flex flex-wrap items-center gap-4 overflow-auto text-[10px]">
      <div className="flex items-center gap-1">
        <span className="opacity-70 mr-1">Items</span>
        {['Rope (50ft)','Rations (5)','Torch (3)','Healer\'s Kit','Potion of Healing'].map(item => (
          <span key={item} className="px-2 py-1 rounded border bg-base-200/40">{item}</span>
        ))}
      </div>

      <div className="opacity-30">|</div>

      <div className="flex items-center gap-3">
        <span className="opacity-70">GP</span><span className="font-semibold">12</span>
        <span className="opacity-70">SP</span><span className="font-semibold">3</span>
        <span className="opacity-70">CP</span><span className="font-semibold">7</span>
        <span className="opacity-70">EP</span><span className="font-semibold">0</span>
        <span className="opacity-70">PP</span><span className="font-semibold">0</span>
      </div>

      <div className=""><span className="opacity-70">Carry</span>: 47 / 135 lb</div>
    </div>
  )
}