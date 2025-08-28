import { io } from 'socket.io-client'

let socket = null

export function connectSocket(){
  if (socket) return socket
  const url = (import.meta.env.VITE_API_BASE && import.meta.env.VITE_API_BASE.startsWith('http')) ? import.meta.env.VITE_API_BASE : ''
  // default to same origin if not set
  socket = io(url || window.location.origin, { transports: ['websocket'] })
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
