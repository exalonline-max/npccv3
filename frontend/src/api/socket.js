import { io } from 'socket.io-client'

let socket = null

export function connectSocket(){
  if (socket) return socket
  const url = (import.meta.env.VITE_API_BASE && import.meta.env.VITE_API_BASE.startsWith('http')) ? import.meta.env.VITE_API_BASE : ''
  // default to same origin if not set
  // Attach auth token so the server can validate socket connections if it wishes.
  let token = null
  try{ token = typeof window !== 'undefined' ? localStorage.getItem('token') : null }catch(e){}
  const opts = { transports: ['websocket'] }
  if (token) opts.auth = { token }
  socket = io(url || window.location.origin, opts)
  // debug logging to aid in diagnosing connection issues
  socket.on('connect_error', (err) => {
    try{ console.warn('Socket connect_error', err && err.message ? err.message : err) }catch(e){}
  })
  socket.on('connect', () => { try{ console.debug('Socket connected', socket.id) }catch(e){} })
  return socket
}

export function onCharacterUpdated(cb){
  const s = connectSocket()
  s.on('character_updated', (payload) => {
    try{ cb && cb(payload) }catch(e){}
  })
  return () => s.off('character_updated')
}

export function disconnectSocket(){
  if (!socket) return
  socket.disconnect()
  socket = null
}

export default {
  connectSocket,
  disconnectSocket,
}
