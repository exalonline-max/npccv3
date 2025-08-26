import React, { useEffect, useState } from 'react'

const initial = [
  {id:1, author:'DM', type:'alert', text:'You hear distant thunder...'},
  {id:2, author:'Arin', type:'msg', text:'I ready my action.'},
]

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

export default function ChatLog(){
  const [msgs, setMsgs] = useState(initial)
  const [text, setText] = useState('')
  const listRef = React.useRef(null)
  const [bottomPad, setBottomPad] = React.useState(0)

  useEffect(()=>{
    function handler(e){
      const d = e.detail
      // if message contains translated payload, push it as translated
      if (d && d.translated) {
        setMsgs(prev => [...prev, {id: d.id, author: d.author, type: 'msg', translated: d.translated, original: d.original, lang: d.lang, pronunciation: d.pronunciation}])
      }
    }
    window.addEventListener('npcchatter:message', handler)
    function onRoll(e){
      const d = e.detail
      if (!d) return
      const id = Date.now()
      // compact format: USER rolled X+Z=Y (label)
      const modPart = d.modifier >= 0 ? `+${d.modifier}` : `${d.modifier}`
      const text = `${d.author || 'You'} rolled ${d.d20}${modPart}=${d.total} (${d.label})`
      setMsgs(prev => [...prev, {id, author: d.author || 'You', type: 'roll', text}])
    }
    window.addEventListener('npcchatter:roll', onRoll)
    return ()=>{
      window.removeEventListener('npcchatter:message', handler)
      window.removeEventListener('npcchatter:roll', onRoll)
    }
  }, [])

  // auto-scroll on new messages
  useEffect(()=>{
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs])

  // dynamically compute paddingBottom based on the bottom bar height
  useEffect(()=>{
    const bar = document.getElementById('player-bottom-bar')
    if (!bar) return
    function recompute(){
      const h = bar.offsetHeight || 0
      // If the app sidebar is fixed above the bottom bar, we don't need
      // to reserve the full bottom-bar height inside the chat area — use a small margin.
      const sidebar = document.getElementById('app-sidebar')
      if (sidebar) {
        setBottomPad(12)
      } else {
        // otherwise reserve the bar height plus a small margin
        setBottomPad(h + 12)
      }
    }
    recompute()
    // use ResizeObserver if available
    let ro = null
    if (window.ResizeObserver){
      ro = new ResizeObserver(()=> recompute())
      ro.observe(bar)
    }
    window.addEventListener('resize', recompute)
    return ()=>{
      window.removeEventListener('resize', recompute)
      if (ro) ro.disconnect()
    }
  }, [])

  function send(){
    if (!text.trim()) return
    setMsgs(prev => [...prev, {id: Date.now(), author:'You', type:'msg', text}])
    setText('')
  }

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const payload = token ? parseJwt(token) : null
  const speaks = payload?.speaks || [] // array of language strings the user understands

  return (
    <div className="card bg-base-200 p-3 flex flex-col h-full min-h-0">
      <div className="font-semibold mb-2">Chat</div>

  <div ref={listRef} className="flex-1 space-y-2 overflow-auto min-h-0" style={{paddingBottom: bottomPad}}>
        {msgs.map(m => (
          <div key={m.id} className="text-sm">
            <div className={
              m.type === 'alert'
                ? 'w-full bg-yellow-50 border border-yellow-200 text-warning px-2 py-1 rounded-md'
                : 'w-full bg-base-300/10 px-2 py-1 rounded-md'
            }>
              {m.translated ? (
                <div className="flex flex-col">
                  <div className="font-medium">{m.author}:</div>
                  <div className="italic whitespace-pre-wrap break-words">{m.translated}</div>
                  {speaks.includes(m.lang) && (
                    <div className="text-xs text-muted">({m.original})</div>
                  )}
                </div>
              ) : m.type === 'roll' ? (
                <div className="flex items-center gap-2 overflow-hidden">
                  <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 flex-none" role="img" aria-label="D20">
                    {/* High-contrast stylized die: warm fill and bold white "20" for dark backgrounds */}
                    <rect x="6" y="6" width="52" height="52" rx="8" fill="#f59e0b" stroke="#111827" strokeWidth="1.6" />
                    <path d="M32 12 L44 20 L52 32 L44 44 L32 52 L20 44 L12 32 L20 20 Z" fill="none" stroke="#92400e" strokeWidth="1" />
                    <text x="32" y="38" textAnchor="middle" fontSize="12" fontWeight="800" fill="#ffffff">20</text>
                  </svg>
                  <div className="truncate text-xs">{m.text}</div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="font-medium">{m.author}:</div>
                  <div className="break-words">{m.text}</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center space-x-2">
        <input value={text} onChange={e=>setText(e.target.value)} className="input input-sm input-bordered flex-1 py-2" placeholder="Say something..." />
        <button onClick={send} className="btn btn-sm py-2" aria-label="Send message" title="Send message">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M2 21l21-9L2 3v7l15 2-15 2v6z" />
          </svg>
          <span className="sr-only">Send</span>
        </button>
      </div>
    </div>
  )
}
