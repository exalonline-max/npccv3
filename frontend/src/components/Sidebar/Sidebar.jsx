import React from 'react'
import PlayerFrame from './PlayerFrame'
import PartyFrames from './PartyFrames'
import ChatLog from './ChatLog'

export default function Sidebar(){
  const [bottomInset, setBottomInset] = React.useState(0)

  // Do not render the sidebar unless an active campaign is selected
  let hasActive = false
  try{
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    if (token){
      try{
        const payload = require('../../lib/jwt').default(token)
        if (payload && (payload.activeCampaign || payload['active-campaign'])) hasActive = true
      }catch(e){}
    }
    if (!hasActive){
      const stored = typeof window !== 'undefined' ? localStorage.getItem('activeCampaign') : null
      if (stored) hasActive = true
    }
  }catch(e){}
  if (!hasActive) return null

  React.useEffect(()=>{
    function recompute(){
      const bar = document.getElementById('player-bottom-bar')
      const h = bar ? bar.offsetHeight : 0
      setBottomInset(h)
    }
    recompute()
    let ro = null
    if (window.ResizeObserver){
      ro = new ResizeObserver(()=> recompute())
      const bar = document.getElementById('player-bottom-bar')
      if (bar) ro.observe(bar)
    }
    window.addEventListener('resize', recompute)
    return ()=>{
      window.removeEventListener('resize', recompute)
      if (ro) ro.disconnect()
    }
  },[])

  // make the sidebar fixed between topbar and bottom bar to avoid layout gaps
  return (
    <aside id="app-sidebar" className="w-72 bg-base-100 border-l overflow-hidden" style={{position:'fixed', right:0, top:'4rem', bottom: `${bottomInset}px`, width: '18rem'}}>
      <div className="p-4 h-full flex flex-col">
        <div className="space-y-4 flex flex-col h-full">
          <div>
            <PlayerFrame />
          </div>

          <div>
            <PartyFrames />
          </div>

          <div className="flex-1 min-h-0">
            <ChatLog />
          </div>

          {/* Game menu moved to player bottom bar */}
        </div>
      </div>
    </aside>
  )
}
