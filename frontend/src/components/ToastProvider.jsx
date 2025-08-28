import React from 'react'
import { nextId } from '../lib/uid'

const ToastContext = React.createContext(null)

export function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export default function ToastProvider({children}){
  const [toasts, setToasts] = React.useState([])

  function addToast({title, body, timeout=4000}){
    const id = nextId()
    setToasts(t => [...t, {id, title, body}])
    if (timeout > 0) setTimeout(()=> setToasts(t => t.filter(x => x.id !== id)), timeout)
    return id
  }

  function removeToast(id){
    setToasts(t => t.filter(x => x.id !== id))
  }

  function ToastItem({t}){
    const [mounted, setMounted] = React.useState(false)
    React.useEffect(()=>{ const id = setTimeout(()=>setMounted(true), 10); return ()=> clearTimeout(id) }, [])
    return (
      <div className={`max-w-sm bg-base-200 border p-3 rounded shadow-lg transform transition-all duration-200 ease-out ${mounted? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
        <div className="flex items-start justify-between">
          <div className="pr-4">
            {t.title && <div className="font-semibold">{t.title}</div>}
            {t.body && <div className="text-sm text-muted">{t.body}</div>}
          </div>
          <div>
            <button aria-label="Dismiss" className="btn btn-ghost btn-xs" onClick={()=> removeToast(t.id)}>×</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <ToastContext.Provider value={{addToast, removeToast}}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2">
        {toasts.map(t => (
          <ToastItem key={t.id} t={t} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
