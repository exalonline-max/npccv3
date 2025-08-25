import React from 'react'

export default function DMBottomBar(){
  return (
    <div className="fixed left-0 right-0 bottom-0 bg-base-100 border-t p-2 z-40">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="font-semibold">DM Controls</div>
        <div className="flex items-center space-x-2">
          <button className="btn btn-sm btn-error">Encounter</button>
          <button className="btn btn-sm">NPCs</button>
          <button className="btn btn-sm">Settings</button>
        </div>
      </div>
    </div>
  )
}
