import React, { useState, useEffect } from 'react'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar/Sidebar'
import PlayerBottomBar from '../components/bottombars/PlayerBottomBar'
import LeftBubbles from '../components/LeftBubbles'
import TranslatorModal from '../components/modules/translator/TranslatorModal'

export default function Dashboard() {
  const [openTranslator, setOpenTranslator] = useState(false)

  useEffect(()=>{
    function onToggle(e){
      const {id, active} = e.detail || {}
      if (id === 'translator') setOpenTranslator(!!active)
    }
    window.addEventListener('npcchatter:bubble-toggle', onToggle)
    return ()=> window.removeEventListener('npcchatter:bubble-toggle', onToggle)
  },[])
  return (
    <div className="min-h-screen bg-base-200">
      <Topbar />

      <div className="flex pt-16 pb-20"> {/* leave space for bottom bar */}
        <main className="flex-1 p-6">
          <h2 className="text-2xl font-semibold">Welcome</h2>
          <p className="mt-2">This is your dashboard. More features coming soon.</p>
        </main>
        <Sidebar />
      </div>

      <LeftBubbles />

      <PlayerBottomBar />

      <TranslatorModal open={openTranslator} onClose={() => {
        setOpenTranslator(false)
        // ensure bubble visually turns off when modal closes
        window.dispatchEvent(new CustomEvent('npcchatter:bubble-set', {detail:{id:'translator', active:false}}))
      }} />
    </div>
  )
}
