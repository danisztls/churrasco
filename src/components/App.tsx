import { useState } from 'react'
import { useGameEngine } from '../multiplayer/useGameEngine'
import { Lobby } from './Lobby'
import { Rules } from './Rules'
import { ScoreBoard } from './ScoreBoard'
import { Table } from './Table'

export function App() {
  const { game } = useGameEngine()
  const [showRules, setShowRules] = useState(false)
  return (
    <>
      {!game ? <Lobby /> : game.phase === 'scored' ? <ScoreBoard /> : <Table />}
      <button
        type="button"
        className="fab"
        title="Como jogar"
        onClick={() => setShowRules(true)}
      >
        ?
      </button>
      {showRules && <Rules onClose={() => setShowRules(false)} />}
    </>
  )
}
