import React from 'react'
import PlayerFrame from './PlayerFrame'
import PartyFrames from './PartyFrames'
import ChatLog from './ChatLog'
import GameMenu from './GameMenu'

export default function Sidebar() {
  return (
    <aside className="w-72 bg-base-100 border-l" style={{height: 'calc(100vh - 4rem)'}}>
      <div className="p-4 h-full flex flex-col">
        <div className="mb-4">
          <div className="text-lg font-bold">Game Sidebar</div>
          <div className="text-sm text-muted">Player tools and chat</div>
        </div>

        <div className="space-y-4 flex flex-col h-full">
          <div>
            <PlayerFrame />
          </div>

          <div>
            <PartyFrames />
          </div>

          <div className="flex-1">
            <ChatLog />
          </div>

          <div>
            <GameMenu />
          </div>
        </div>
      </div>
    </aside>
  )
}
