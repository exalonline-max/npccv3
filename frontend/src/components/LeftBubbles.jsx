import React, { useState, useEffect } from 'react'

export default function LeftBubbles({initial=[]}){
  const defaults = [
  {id:'translator', title:'Translator', icon:'🌐', active:false},
  {id:'charactersheet', title:'Character', icon:'🧭', active:false},
  {id:'guardian', title:'Guardian Mode', icon:'🛡️', active:false},
  {id:'infiltrator', title:'Infiltrator Mode', icon:'🗡️', active:false}
  ];
  const [bubbles, setBubbles] = useState(initial.length? initial : defaults);

  useEffect(()=>{
    function onSet(e){
      const {id, active} = e.detail || {}
      if (!id) return
      setBubbles(prev => prev.map(b => b.id===id ? {...b, active: !!active} : b))
    }
    window.addEventListener('npcchatter:bubble-set', onSet)
    return ()=> window.removeEventListener('npcchatter:bubble-set', onSet)
  },[])

  function toggle(id){
    const next = bubbles.map(b => b.id===id? {...b, active: !b.active} : b);
    setBubbles(next);
    const changed = next.find(b=>b.id===id);
    window.dispatchEvent(new CustomEvent('npcchatter:bubble-toggle', {detail: {id, active: changed.active}}));
  }

  return (
    <div className="fixed left-3 top-1/3 z-50 flex flex-col gap-2">
      {bubbles.map(b => (
        <div key={b.id} className="tooltip tooltip-right" data-tip={b.title}>
          <button
            aria-label={b.title}
            onClick={()=>toggle(b.id)}
            className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg text-sm ${b.active? 'bg-primary text-white' : 'bg-base-100 text-base-content'}`}
          >
            <span aria-hidden>{b.icon}</span>
          </button>
        </div>
      ))}
    </div>
  )
}
