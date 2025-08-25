import React from 'react'
import PlayerFrame from './PlayerFrame'
import PartyFrames from './PartyFrames'
import ChatLog from './ChatLog'
import GameMenu from './GameMenu'

export default function Sidebar() {
  return (
    <aside className="w-72 bg-base-100 border-r h-[calc(100vh-64px)] overflow-auto p-4">
      <div className="mb-4">
        <div className="text-lg font-bold">Game Sidebar</div>
        <div className="text-sm text-muted">Player tools and chat</div>
      </div>

      <div className="space-y-4">
        <PlayerFrame />
        <PartyFrames />
        <ChatLog />
        <GameMenu />
      </div>
    </aside>
  )
}
