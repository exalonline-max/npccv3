import React, { useEffect, useState } from 'react'
import { nextId } from '../../lib/uid'
import client from '../../api/client'
import parseJwt from '../../lib/jwt'

const initial = [
  {id:1, author:'DM', type:'alert', text:'You hear distant thunder...'},
  {id:2, author:'Arin', type:'msg', text:'I ready my action.'},
]


export default function ChatLog(){
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const payload = token ? parseJwt(token) : null
  const speaks = payload?.speaks || []

  const [msgs, setMsgs] = useState(initial)
  const [text, setText] = useState('')
  const listRef = React.useRef(null)
  const [bottomPad, setBottomPad] = React.useState(0)
  const socketRef = React.useRef(null)

  function formatTime(ts){
    if (!ts) return ''
    const d = new Date(ts)
    const hh = String(d.getHours()).padStart(2,'0')
    const mm = String(d.getMinutes()).padStart(2,'0')
    return `${hh}:${mm}`
  }

  useEffect(()=>{
    function handler(e){
      const d = e.detail
      if (d && d.translated) {
        setMsgs(prev => [...prev, {id: d.id || nextId(), author: d.author, type: 'msg', translated: d.translated, original: d.original, lang: d.lang, pronunciation: d.pronunciation, avatar: d.avatar || null, timestamp: Date.now()}])
      }
    }
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('npcchatter:message', handler)
    }

    function onRoll(e){
      const d = e.detail
      if (!d) return
      const id = Date.now()
      const modPart = d.modifier >= 0 ? `+${d.modifier}` : `${d.modifier}`
      const text = `${d.author || 'You'} rolled ${d.d20}${modPart}=${d.total} (${d.label})`
      const avatar = d.avatar || (d.author === (payload?.name || 'You') ? (payload?.picture || null) : null)
      setMsgs(prev => [...prev, {id, author: d.author || 'You', type: 'roll', text, meta: d, avatar, timestamp: Date.now()}])
    }
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('npcchatter:roll', onRoll)
    }

    async function onCampaignChange(e){
      const campaign = e?.detail?.campaign || null
      // clear existing messages and show a notice
      setMsgs([{id: Date.now(), author:'System', type:'alert', text: campaign ? `Switched to campaign: ${campaign}` : 'No campaign selected', timestamp: Date.now()}])

      // try to fetch recent messages for the campaign if backend supports it
      if (campaign && typeof window !== 'undefined'){
        try{
          const data = await client.get('/campaigns/' + encodeURIComponent(campaign) + '/messages')
          if (Array.isArray(data)){
            setMsgs(prev => [...prev, ...data.map(m=>({
              id: m.id || nextId(),
              author: m.author || 'Unknown',
              type: m.type || 'msg',
              text: m.text || m.body || '',
              translated: m.translated || null,
              original: m.original || null,
              avatar: m.avatar || null,
              timestamp: m.timestamp || Date.now()
            }))])
          }

          // join socket room using campaignId
          if (socketRef.current && campaignId) {
            try{
              socketRef.current.emit('leave', {campaign: socketRef.current.__joinedCampaign})
              socketRef.current.emit('join', {campaign: campaignId})
              socketRef.current.__joinedCampaign = campaignId
            }catch(e){/* ignore socket errors */}
          }
        }catch(err){
          // ignore fetch errors - backend may not expose this endpoint yet
        }
      }
    }
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('npcchatter:campaign-changed', onCampaignChange)
    }

    // connect socket on mount
    if (typeof window !== 'undefined') {
      (async ()=>{
        try{
          const sockMod = await import('../../api/socket')
          const sock = sockMod.connectSocket()
          socketRef.current = sock
          // on receiving campaign messages, append if not duplicate
          if (typeof sock.on === 'function') {
            sock.on('campaign_message', (msg)=>{
              setMsgs(prev => {
                if (prev.some(p=>String(p.id) === String(msg.id))) return prev
                return [...prev, msg]
              })
            })
          }
        }catch(e){/* ignore */}
      })()
    }

    return ()=>{
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('npcchatter:message', handler)
        window.removeEventListener('npcchatter:roll', onRoll)
        window.removeEventListener('npcchatter:campaign-changed', onCampaignChange)
      }
      // disconnect socket
      try{
        if (socketRef.current) {
          if (typeof socketRef.current.off === 'function') socketRef.current.off('campaign_message')
          if (typeof socketRef.current.disconnect === 'function') socketRef.current.disconnect()
          socketRef.current = null
        }
      }catch(e){}
    }
  }, [payload])

  useEffect(()=>{
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs])

  useEffect(()=>{
    const bar = document.getElementById('player-bottom-bar')
    if (!bar) return
    function recompute(){
      const h = bar.offsetHeight || 0
      const sidebar = document.getElementById('app-sidebar')
      if (sidebar) setBottomPad(12)
      else setBottomPad(h + 12)
    }
    recompute()
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
    const avatar = payload?.picture || null
    const body = text.trim()
    setText('')
    const localMsg = {id: Date.now(), author:'You', type:'msg', text: body, avatar, timestamp: Date.now()}
    // try to post to campaign endpoint if activeCampaignId present
    const activeId = typeof window !== 'undefined' ? localStorage.getItem('activeCampaignId') : null
    if (activeId) {
      (async ()=>{
        try{
          const res = await client.post('/campaigns/' + encodeURIComponent(activeId) + '/messages', {text: body})
          // append server response if available
          if (res && res.id) {
            setMsgs(prev => [...prev, res])
          } else {
            setMsgs(prev => [...prev, localMsg])
          }
        }catch(err){
          // fallback to local append on error
          setMsgs(prev => [...prev, localMsg])
        }
      })()
    } else {
      setMsgs(prev => [...prev, localMsg])
    }
  }

  return (
    <div className="card bg-base-200 px-2 py-3 flex flex-col h-full min-h-0">
      <div className="font-semibold mb-2">Chat</div>

      <div ref={listRef} className="flex-1 space-y-0.5 overflow-auto min-h-0" style={{paddingBottom: bottomPad}}>
        {msgs.map(m => (
          <div key={m.id} className="flex items-start gap-0.5 text-sm">
            {/* avatar */}
            {m.avatar ? (
              <img src={m.avatar} alt={`${m.author} avatar`} className="w-4 h-4 rounded-full flex-none" />
            ) : (
              <img
                src={`https://api.dicebear.com/6.x/identicon/svg?seed=${encodeURIComponent(m.author || 'anon')}&size=40`}
                alt={`${m.author || 'Anonymous'} avatar`}
                className="w-4 h-4 rounded-full flex-none object-cover"
              />
            )}

            <div className="flex-1">
              {m.type === 'alert' && (
                <div className="group bg-yellow-50 border border-yellow-200 text-warning px-1 py-0.5 rounded-md w-full">
                  <div className="text-sm">{m.text}</div>
                  <div className="mt-0 text-xs text-muted opacity-0 group-hover:opacity-100 transition-opacity">{formatTime(m.timestamp)}</div>
                </div>
              )}

              {m.translated && (
                <>
                  <div className="group bg-base-300/10 px-1 py-0.5 rounded-md w-full">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{m.author}:</div>
                        <div className="italic whitespace-pre-wrap break-words text-sm">{m.translated}</div>
                      </div>
                      <div className="ml-2 text-xs text-muted flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">{formatTime(m.timestamp)}</div>
                    </div>
                  </div>
                  {m.original && (
                    <div className="mt-0.5 group bg-base-200/5 px-1 py-0.5 rounded-md text-xs text-muted italic w-full">{m.original}</div>
                  )}
                </>
              )}

              {m.type === 'roll' && !m.translated && (
                <div className="group bg-base-300/10 px-1 py-0.5 rounded-md w-full">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col overflow-hidden">
                      <div className="font-semibold text-sm">
                        {m.author ? `${m.author} — ` : ''}
                        {m.meta ? (
                          <span>
                            {m.meta.total}
                            {m.meta.d20 === 20 ? <span className="ml-1">🎉</span> : m.meta.d20 === 1 ? <span className="ml-1">💀</span> : null}
                          </span>
                        ) : ''}
                      </div>
                      <div className="text-[11px] text-muted truncate">{m.meta ? `${m.meta.d20}${m.meta.modifier>=0? '+'+m.meta.modifier : m.meta.modifier} → ${m.meta.total} (${m.meta.label})` : m.text}</div>
                    </div>
                    <div className="ml-2 text-xs text-muted flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">{formatTime(m.timestamp)}</div>
                  </div>
                </div>
              )}

              {(!m.translated && m.type !== 'roll' && m.type !== 'alert') && (
                <div className="group bg-base-300/10 px-1 py-0.5 rounded-md w-full">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{m.author}:</div>
                      <div className="break-words text-sm">{m.text}</div>
                    </div>
                    <div className="ml-2 text-xs text-muted flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">{formatTime(m.timestamp)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center space-x-2">
        <input
          value={text}
          onChange={e=>setText(e.target.value)}
          onKeyDown={(e)=>{
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          className="input input-sm input-bordered flex-1 py-1"
          placeholder="Say something..."
        />
        <button onClick={send} className="btn btn-sm py-1" aria-label="Send message" title="Send message">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M2 21l21-9L2 3v7l15 2-15 2v6z" />
          </svg>
          <span className="sr-only">Send</span>
        </button>
      </div>
    </div>
  )
}
