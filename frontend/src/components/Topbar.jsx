import React from 'react'
import TranslatorModal from './modules/translator/TranslatorModal'

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

  // Logo path: prefer /circle-griff.png but fall back to /circle-griff.svg (placed in frontend/public)
  const logoPng = '/circle-griff.png'
  const logoSvg = '/circle-griff.svg'
  const [logoSrc, setLogoSrc] = React.useState(logoPng)
  const [transOpen, setTransOpen] = React.useState(false)

  function doSkillRoll(label){
    const res = 1 + Math.floor(Math.random()*20)
    window.dispatchEvent(new CustomEvent('npcchatter:roll', {detail: {sides:20, result:res, label}}))
  }

  function logout() {
    localStorage.removeItem('token')
    window.location.href = '/'
  }

  return (
    <div className="navbar bg-base-100 shadow fixed top-0 left-0 right-0 z-40 h-16">
      <div className="flex-1 px-4 items-center flex">
  <img src={logoSrc} alt="NPC Chatter" className="w-10 h-10 rounded-full mr-3 border" onError={(e)=>{ if (logoSrc !== logoSvg) { setLogoSrc(logoSvg) } else { e.target.style.display='none' } }} />
        <span className="text-xl font-bold">Campaign Name</span>
      </div>

      <div className="flex-none">
        <div className="text-center">
          <div className="font-semibold">{activeCampaign || 'No campaign selected'}</div>
        </div>
      </div>

      <div className="flex-none pr-4 flex items-center space-x-2">
        <div className="dropdown">
          <label tabIndex={0} className="btn btn-ghost btn-sm">Skills</label>
          <ul tabIndex={0} className="mt-3 p-2 shadow menu menu-compact dropdown-content bg-base-100 rounded-box w-52">
            <li><button onClick={()=>doSkillRoll('Athletics')}>Athletics</button></li>
            <li><button onClick={()=>doSkillRoll('Acrobatics')}>Acrobatics</button></li>
            <li><button onClick={()=>doSkillRoll('Perception')}>Perception</button></li>
            <li><button onClick={()=>doSkillRoll('Stealth')}>Stealth</button></li>
          </ul>
        </div>

        <button className="btn btn-ghost btn-sm">Spells & Actions</button>

        <button className="btn btn-ghost btn-sm" onClick={()=>setTransOpen(true)}>Open Translator</button>

        <div className="dropdown dropdown-end">
          <label tabIndex={0} className="btn btn-ghost btn-circle avatar">
            <div className="w-10 rounded-full border">
              <img src={avatarUrl} alt="avatar" />
            </div>
          </label>
          <ul tabIndex={0} className="mt-3 p-2 shadow menu menu-compact dropdown-content bg-base-100 rounded-box w-52">
            <li><a>Options</a></li>
            <li><a onClick={logout}>Logout</a></li>
          </ul>
        </div>
        <TranslatorModal open={transOpen} onClose={()=>setTransOpen(false)} />
      </div>
    </div>
  )
}
