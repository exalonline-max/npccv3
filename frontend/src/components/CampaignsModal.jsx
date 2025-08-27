import React from 'react'
import client from '../api/client'

export default function CampaignsModal({open, onClose}){
  const [name, setName] = React.useState('')
  const [code, setCode] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [msg, setMsg] = React.useState(null)

  React.useEffect(()=>{
    if (!open) return
    function onKey(e){
      if (e.key === 'Escape') onClose && onClose()
    }
    window.addEventListener('keydown', onKey)
    return ()=> window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  async function createCampaign(){
    setLoading(true)
    setMsg(null)
    try{
  const res = await client.post('/campaigns', {name})
      // backend should return created campaign name or id
      const campaignName = res?.name || res?.id || name
      localStorage.setItem('activeCampaign', campaignName)
      window.dispatchEvent(new CustomEvent('npcchatter:campaign-changed', {detail:{campaign: campaignName}}))
      setMsg('Created and selected: ' + campaignName)
    }catch(e){
      setMsg(e.message)
    }finally{setLoading(false)}
  }

  async function joinCampaign(){
    setLoading(true)
    setMsg(null)
    try{
      const res = await client.post('/campaigns/join', {code})
      const campaignName = res?.name || res?.id || code
      localStorage.setItem('activeCampaign', campaignName)
      window.dispatchEvent(new CustomEvent('npcchatter:campaign-changed', {detail:{campaign: campaignName}}))
      setMsg('Joined and selected: ' + campaignName)
    }catch(e){
      setMsg(e.message)
    }finally{setLoading(false)}
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-base-100 rounded-lg p-4 w-96">
        <h3 className="font-semibold mb-2">Manage Campaigns</h3>
        <div className="mb-3">
          <label className="label"><span className="label-text">Create campaign</span></label>
          <input className="input input-sm w-full" value={name} onChange={e=>setName(e.target.value)} placeholder="Campaign name" />
          <div className="mt-2 flex justify-end">
            <button className="btn btn-sm" onClick={createCampaign} disabled={loading || !name}>Create</button>
          </div>
        </div>

        <div className="mb-3">
          <label className="label"><span className="label-text">Join by code</span></label>
          <input className="input input-sm w-full" value={code} onChange={e=>setCode(e.target.value)} placeholder="Invite code" />
          <div className="mt-2 flex justify-end">
            <button className="btn btn-sm" onClick={joinCampaign} disabled={loading || !code}>Join</button>
          </div>
        </div>

        {msg && <div className="mt-2 text-sm text-muted">{msg}</div>}

        <div className="mt-4 flex justify-end">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
