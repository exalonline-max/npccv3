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
      const text = `${d.author || 'You'} rolled ${d.d20} ${d.modifier>=0? '+'+d.modifier : d.modifier} = ${d.total} (${d.label})`
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
          <div key={m.id} className={m.type === 'alert' ? 'text-sm text-warning' : 'text-sm'}>
            <span className="font-medium">{m.author}:</span>
            {' '}
            {m.translated ? (
              // show fantasy language to everyone; show original english if user speaks the language
              <>
                <span className="italic">{m.translated}</span>
                {speaks.includes(m.lang) && (
                  <div className="text-xs text-muted">({m.original})</div>
                )}
              </>
            ) : (
              m.text
            )}
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
