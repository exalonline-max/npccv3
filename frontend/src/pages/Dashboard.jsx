import React, { useState, useEffect } from 'react'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar/Sidebar'
import PlayerBottomBar from '../components/bottombars/PlayerBottomBar'
import LeftBubbles from '../components/LeftBubbles'
import TranslatorModal from '../components/modules/translator/TranslatorModal'
import CharacterSheetModal from '../components/modules/charactersheet/CharacterSheetModal'
import client from '../api/client'

export default function Dashboard() {
  const [openTranslator, setOpenTranslator] = useState(false)
  const [openCharacter, setOpenCharacter] = useState(false)

  useEffect(()=>{
    function onToggle(e){
      const {id, active} = e.detail || {}
  if (id === 'translator') setOpenTranslator(!!active)
  if (id === 'charactersheet') setOpenCharacter(!!active)
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
          <div className="mt-4">
            <button className="btn btn-sm" onClick={async ()=>{
              try{
                const camp = await client.post('/campaigns/test/join')
                const campaignName = camp?.name || camp?.id
                if (campaignName) {
                  localStorage.setItem('activeCampaign', campaignName)
                  window.dispatchEvent(new CustomEvent('npcchatter:campaign-changed', {detail:{campaign: campaignName}}))
                }
                alert('Joined test campaign: ' + campaignName)
              }catch(e){
                alert('Failed: ' + (e.message || e))
              }
            }}>Join Test Campaign</button>
          </div>
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

      <CharacterSheetModal open={openCharacter} onClose={() => {
        setOpenCharacter(false)
        window.dispatchEvent(new CustomEvent('npcchatter:bubble-set', {detail:{id:'charactersheet', active:false}}))
      }} />
    </div>
  )
}
