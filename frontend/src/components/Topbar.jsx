import React from 'react'
import CampaignsModal from './CampaignsModal'

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        })
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch (e) {
    return null
  }
}

export default function Topbar() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const payload = token ? parseJwt(token) : null
  const email = payload?.email || payload?.sub || 'unknown@npcchatter.com'
  const seed = encodeURIComponent(email)
  const avatarUrl = `https://api.dicebear.com/6.x/identicon/svg?seed=${seed}`

  // active-campaign might be a top-level claim or inside a nested object depending on backend
  const activeCampaign = payload?.['active-campaign'] || payload?.activeCampaign || null

  // campaigns claim may be an array of names or objects; support common claim names
  const rawCampaigns = payload?.campaigns || payload?.campaignsList || payload?.campaign_list || payload?.memberships || null
  const campaignItems = Array.isArray(rawCampaigns) ? rawCampaigns : (rawCampaigns ? [rawCampaigns] : [])
  const campaignNames = campaignItems.map(c => (typeof c === 'string' ? c : (c.name || c.title || c.id || String(c))))

  const initialSelectedCampaign = (() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('activeCampaign')
      if (stored) return stored
    }
    if (activeCampaign) return activeCampaign
    if (campaignNames.length === 1) return campaignNames[0]
    return null
  })()

  const [selectedCampaign, setSelectedCampaign] = React.useState(initialSelectedCampaign)

  // persist selection and notify app when it changes
  React.useEffect(()=>{
    if (typeof window === 'undefined') return
    if (selectedCampaign) localStorage.setItem('activeCampaign', selectedCampaign)
    else localStorage.removeItem('activeCampaign')
    window.dispatchEvent(new CustomEvent('npcchatter:campaign-changed', {detail: {campaign: selectedCampaign}}))

    // persist server-side when possible and resolve campaign id
    if (selectedCampaign !== null) {
      (async ()=>{
        try{
          const clientMod = await import('../api/client')
          const client = clientMod.default
          // fetch user's campaigns and find the id
          const camps = await client.get('/campaigns')
          const found = Array.isArray(camps) ? camps.find(c => c.name === selectedCampaign || String(c.id) === String(selectedCampaign)) : null
          if (found) {
            localStorage.setItem('activeCampaignId', String(found.id))
            // persist by id to server
            const res = await client.put('/users/me/active-campaign', {campaign: found.id})
            if (res && res.token) localStorage.setItem('token', res.token)
          } else {
            // fallback: try persisting by name
            const res = await client.put('/users/me/active-campaign', {campaign: selectedCampaign}).catch(()=>null)
            if (res && res.token) localStorage.setItem('token', res.token)
          }
        }catch(e){
          // ignore errors for now
        }
      })()
    }
  }, [selectedCampaign])

  // react to external campaign-changed events (created/joined from modal)
  React.useEffect(()=>{
    function onExternal(e){
      const c = e?.detail?.campaign || null
      if (c) setSelectedCampaign(c)
    }
    window.addEventListener('npcchatter:campaign-changed', onExternal)
    return ()=> window.removeEventListener('npcchatter:campaign-changed', onExternal)
  }, [])

  // Logo path: prefer /circle-griff.png but fall back to /circle-griff.svg (placed in frontend/public)
  const logoPng = '/circle-griff.png'
  const logoSvg = '/circle-griff.svg'
  const [logoSrc, setLogoSrc] = React.useState(logoPng)


  function logout() {
    localStorage.removeItem('token')
    window.location.href = '/'
  }

  const [campaignModalOpen, setCampaignModalOpen] = React.useState(false)

  return (
    <div className="navbar bg-base-100 shadow fixed top-0 left-0 right-0 z-40 h-16">
      <div className="flex-1 px-4 items-center flex">
  <img src={logoSrc} alt="NPC Chatter" className="w-10 h-10 rounded-full mr-3 border" onError={(e)=>{ if (logoSrc !== logoSvg) { setLogoSrc(logoSvg) } else { e.target.style.display='none' } }} />
        <span className="text-xl font-bold">{selectedCampaign || 'Campaign Name'}</span>
      </div>

      

  <div className="flex-none pr-4 flex items-center space-x-2">
        

        <div className="dropdown dropdown-end">
          <label tabIndex={0} className="btn btn-ghost btn-circle avatar">
            <div className="w-10 rounded-full border">
              <img src={avatarUrl} alt="avatar" />
            </div>
          </label>
          <ul tabIndex={0} className="mt-3 p-2 shadow menu menu-compact dropdown-content bg-base-100 rounded-box w-52">
            <li className="px-2 py-1">
              <div className="text-xs text-muted">Active campaign</div>
              <div className="mt-1">
                {campaignNames.length > 0 ? (
                  <select className="select select-sm w-full" value={selectedCampaign || ''} onChange={(e)=>setSelectedCampaign(e.target.value)}>
                    <option value="">None</option>
                    {campaignNames.map(cn => <option key={cn} value={cn}>{cn}</option>)}
                  </select>
                ) : (
                  <div className="text-sm text-muted">No campaigns in token</div>
                )}
              </div>
            </li>
            <li><a>Options</a></li>
            <li><a onClick={logout}>Logout</a></li>
          </ul>
        </div>
  <button className="btn btn-ghost btn-sm" onClick={()=>setCampaignModalOpen(true)}>Campaigns</button>
  {!selectedCampaign && (
    <button
      className="btn btn-sm btn-primary"
      onClick={async ()=>{
        try{
          const clientMod = await import('../api/client')
          const client = clientMod.default
          const camp = await client.post('/campaigns/test/join')
          const campaignName = camp?.name || camp?.id
          if (campaignName) setSelectedCampaign(campaignName)
          // Topbar effect will persist selection server-side
        }catch(e){
          console.error('Failed to join test campaign', e)
          alert('Failed to join test campaign: ' + (e.message || e))
        }
      }}
    >Join Test Campaign</button>
  )}
  <CampaignsModal open={campaignModalOpen} onClose={()=>setCampaignModalOpen(false)} />
      </div>
    </div>
  )
}
