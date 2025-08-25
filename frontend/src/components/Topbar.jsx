import React from 'react'

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

  function logout() {
    localStorage.removeItem('token')
    window.location.href = '/'
  }

  return (
    <div className="navbar bg-base-100 shadow fixed top-0 left-0 right-0 z-40 h-16">
      <div className="flex-1 px-4 items-center flex">
  <img src={logoSrc} alt="NPC Chatter" className="w-10 h-10 rounded-full mr-3 border" onError={(e)=>{ if (logoSrc !== logoSvg) { setLogoSrc(logoSvg) } else { e.target.style.display='none' } }} />
        <span className="text-xl font-bold">NPC Chatter</span>
      </div>

      <div className="flex-none">
        <div className="text-center">
          <div className="font-semibold">{activeCampaign || 'No campaign selected'}</div>
        </div>
      </div>

      <div className="flex-none pr-4">
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
      </div>
    </div>
  )
}
