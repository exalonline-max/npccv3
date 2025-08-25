import React from 'react'

export default function PlayerBottomBar(){
  return (
    <div className="fixed left-0 right-0 bottom-0 bg-base-100 border-t p-2 z-40">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="font-semibold">You</div>
          <div className="w-40 bg-gray-200 rounded h-3 overflow-hidden">
            <div className="bg-red-500 h-3" style={{width: '72%'}} />
          </div>
          <div className="text-sm">HP 29/40</div>
        </div>

        <div className="flex items-center space-x-2">
          <button className="btn btn-sm">Action</button>
          <button className="btn btn-sm">Spell</button>
          <button className="btn btn-sm">Inventory</button>
        </div>
      </div>
    </div>
  )
}
