import { useState } from 'react'
import { useGameEngine } from '../multiplayer/useGameEngine'
import { Lobby } from './Lobby'
import { OverlayHost } from './OverlayHost'
import { Rules } from './Rules'
import { ScoreBoard } from './ScoreBoard'
import { isMuted, setMuted } from './sfx'
import { Table } from './Table'
import { useAnnouncements } from './useAnnouncements'
import { useSfx } from './useSfx'

export function App() {
  const { game, me, myMoves } = useGameEngine()
  const [showRules, setShowRules] = useState(false)
  const [muted, setMutedState] = useState(isMuted())
  useSfx(game, me.id, myMoves.length > 0)
  useAnnouncements(game, me.id)
  return (
    <>
      {!game ? <Lobby /> : game.phase === 'scored' ? <ScoreBoard /> : <Table />}
      <OverlayHost />
      <button
        type="button"
        className="fab"
        title="Como jogar"
        onClick={() => setShowRules(true)}
      >
        ?
      </button>
      <button
        type="button"
        className="fab fab-sound"
        title={muted ? 'Ativar sons' : 'Silenciar sons'}
        onClick={() => {
          setMuted(!muted)
          setMutedState(!muted)
        }}
      >
        {muted ? '🔇' : '🔊'}
      </button>
      {showRules && <Rules onClose={() => setShowRules(false)} />}
    </>
  )
}
