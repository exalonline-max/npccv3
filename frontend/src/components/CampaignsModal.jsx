import React from 'react'
import client from '../api/client'

export default function CampaignsModal({open, onClose}){
  const [name, setName] = React.useState('')
  const [code, setCode] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [msg, setMsg] = React.useState(null)
  const [campaigns, setCampaigns] = React.useState([])
  const [campaignsLoading, setCampaignsLoading] = React.useState(false)
  const [filter, setFilter] = React.useState('')

  React.useEffect(()=>{
    if (!open) return
    function onKey(e){
      if (e.key === 'Escape') onClose && onClose()
    }
    window.addEventListener('keydown', onKey)
    return ()=> window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // fetch public campaigns when modal opens
  React.useEffect(()=>{
    if (!open) return
    let cancelled = false
    setCampaignsLoading(true)
    client.get('/campaigns/public').then(res=>{
      if (cancelled) return
      if (Array.isArray(res)) setCampaigns(res)
      else setCampaigns([])
    }).catch(()=>{
      if (cancelled) return
      setCampaigns([])
    }).finally(()=>{
      if (!cancelled) setCampaignsLoading(false)
    })
    return ()=>{ cancelled = true }
  }, [open])

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
      // refresh list
      try{ const list = await client.get('/campaigns/public'); if (Array.isArray(list)) setCampaigns(list) }catch(e){}
    }catch(e){
      setMsg(e.message)
    }finally{setLoading(false)}
  }

  async function joinCampaignById(cid){
    setLoading(true)
    setMsg(null)
    try{
      const res = await client.post(`/campaigns/${cid}/join`)
      const campaignName = res?.name || res?.id || cid
      localStorage.setItem('activeCampaign', campaignName)
      window.dispatchEvent(new CustomEvent('npcchatter:campaign-changed', {detail:{campaign: campaignName}}))
      setMsg('Joined and selected: ' + campaignName)
      onClose && onClose()
      try{ const list = await client.get('/campaigns/public'); if (Array.isArray(list)) setCampaigns(list) }catch(e){}
    }catch(e){
      setMsg(e.message)
    }finally{setLoading(false)}
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-base-100 rounded-lg p-4 w-11/12 max-w-2xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Manage Campaigns</h3>
          <div className="flex items-center space-x-2">
            <input
              className="input input-sm bg-neutral-800 border border-neutral-600 placeholder:text-neutral-400 placeholder:opacity-90 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Filter campaigns"
              value={filter}
              onChange={e=>setFilter(e.target.value)}
            />
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="mb-2 text-sm text-muted">Create new campaign</div>
            <div className="flex gap-2">
              <input
                className="input input-sm flex-1 bg-neutral-800 border border-neutral-600 placeholder:text-neutral-400 placeholder:opacity-90 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={name}
                onChange={e=>setName(e.target.value)}
                placeholder="Campaign name"
              />
              <button className="btn btn-sm" onClick={createCampaign} disabled={loading || !name}>Create</button>
            </div>

            <div className="mt-4 text-sm text-muted">Join by invite code</div>
            <div className="flex gap-2 mt-2">
              <input
                className="input input-sm flex-1 bg-neutral-800 border border-neutral-600 placeholder:text-neutral-400 placeholder:opacity-90 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={code}
                onChange={e=>setCode(e.target.value)}
                placeholder="Invite code"
              />
              <button className="btn btn-sm" onClick={joinCampaign} disabled={loading || !code}>Join</button>
            </div>

            {msg && <div className="mt-3 text-sm text-muted">{msg}</div>}
          </div>

          <div>
            <div className="mb-2 text-sm text-muted">Available campaigns</div>
    <div className="h-64 overflow-auto border rounded p-2 bg-neutral-900/40">
              {campaignsLoading ? (
                <div className="text-sm text-muted">Loading campaigns...</div>
              ) : (
                (campaigns || []).filter(c => !filter || (c.name || '').toLowerCase().includes(filter.toLowerCase()) || (c.invite_code||'').toLowerCase().includes(filter.toLowerCase())).map(c => (
      <div key={c.id || c.invite_code} className="flex items-center justify-between p-2 hover:bg-neutral-800/60 rounded">
                    <div>
                      <div className="font-medium">{c.name || `#${c.id}`}</div>
                      <div className="text-xs text-muted">Code: {c.invite_code || '—'} • Owner: {c.owner || '—'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="btn btn-xs" onClick={()=>{ localStorage.setItem('activeCampaign', c.name || String(c.id)); window.dispatchEvent(new CustomEvent('npcchatter:campaign-changed', {detail:{campaign: c.name || String(c.id)}})); onClose && onClose(); }}>Select</button>
                      <button className="btn btn-xs btn-outline" onClick={()=>joinCampaignById(c.id)}>Join</button>
                    </div>
                  </div>
                ))
              )}
              {!campaignsLoading && (!campaigns || campaigns.length === 0) && (
                <div className="text-sm text-muted">No campaigns available</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
