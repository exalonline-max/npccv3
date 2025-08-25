import React, { useState } from 'react'

const initial = [
  {id:1, author:'DM', type:'alert', text:'You hear distant thunder...'},
  {id:2, author:'Arin', type:'msg', text:'I ready my action.'},
]

export default function ChatLog(){
  const [msgs, setMsgs] = useState(initial)
  const [text, setText] = useState('')

  function send(){
    if (!text.trim()) return
    setMsgs(prev => [...prev, {id: Date.now(), author:'You', type:'msg', text}])
    setText('')
  }

  return (
    <div className="card bg-base-200 p-3">
      <div className="font-semibold mb-2">Chat</div>
      <div className="space-y-2 max-h-40 overflow-auto">
        {msgs.map(m => (
          <div key={m.id} className={m.type === 'alert' ? 'text-sm text-warning' : 'text-sm'}>
            <span className="font-medium">{m.author}:</span> {m.text}
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
