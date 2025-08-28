import React from 'react'
import { getToken, setToken, clearToken } from '../lib/token'
import parseJwt from '../lib/jwt'

type User = { id?: any, email?: string, username?: string } | null

export const AuthContext = React.createContext({ user: null as User, token: null as string | null, setAuth: (t:any,u:any)=>{} , clearAuth: ()=>{} })

export function useAuth(){
  return React.useContext(AuthContext)
}

export function AuthProvider({ children }:{children:any}){
  const [token, setT] = React.useState(() => getToken())
  const [user, setU] = React.useState(() => {
    const t = getToken()
    if (!t) return null
    const p = parseJwt(t)
    return p ? { id: p.sub, email: p.email, username: p.username } : null
  })

  function setAuth(newToken:any, newUser?:any){
    try{ setToken(newToken) }catch(e){}
    setT(typeof newToken === 'string'? newToken : null)
    if (newUser) setU(newUser)
    else {
      const p = parseJwt(typeof newToken === 'string' ? newToken : '')
      if (p) setU({ id: p.sub, email: p.email, username: p.username })
    }
  }

  function clearAuth(){
    try{ clearToken() }catch(e){}
    setT(null)
    setU(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, setAuth, clearAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthProvider
