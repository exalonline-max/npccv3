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

  useEffect(()=>{
    function handler(e){
      const d = e.detail
      // if message contains translated payload, push it as translated
      if (d && d.translated) {
        setMsgs(prev => [...prev, {id: d.id, author: d.author, type: 'msg', translated: d.translated, original: d.original, lang: d.lang, pronunciation: d.pronunciation}])
      }
    }
    window.addEventListener('npcchatter:message', handler)
    return ()=> window.removeEventListener('npcchatter:message', handler)
  }, [])

  // auto-scroll on new messages
  useEffect(()=>{
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs])

  function send(){
    if (!text.trim()) return
    setMsgs(prev => [...prev, {id: Date.now(), author:'You', type:'msg', text}])
    setText('')
  }

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const payload = token ? parseJwt(token) : null
  const speaks = payload?.speaks || [] // array of language strings the user understands

  return (
    <div className="card bg-base-200 p-3 flex flex-col h-full">
      <div className="font-semibold mb-2">Chat</div>

      <div ref={listRef} className="flex-1 space-y-2 overflow-auto">
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

      <div className="mt-3 flex space-x-2">
        <input value={text} onChange={e=>setText(e.target.value)} className="input input-sm input-bordered flex-1" placeholder="Say something..." />
        <button onClick={send} className="btn btn-sm">Send</button>
      </div>
    </div>
  )
}
