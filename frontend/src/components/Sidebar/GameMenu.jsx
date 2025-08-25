import React, { useState } from 'react'
import TranslatorModal from '../modules/translator/TranslatorModal'

export default function GameMenu(){
  const [open, setOpen] = useState(false)
  return (
    <div className="card bg-base-200 p-3">
      <div className="font-semibold">Game Menu</div>
      <div className="text-sm text-muted">Placeholder for game controls</div>
      <div className="mt-3">
        <button className="btn btn-sm" onClick={()=>setOpen(true)}>Open Translator</button>
      </div>

      <TranslatorModal open={open} onClose={()=>setOpen(false)} />
    </div>
  )
}
