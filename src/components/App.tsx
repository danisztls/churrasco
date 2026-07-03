import { useGameEngine } from '../multiplayer/useGameEngine'
import { Lobby } from './Lobby'
import { ScoreBoard } from './ScoreBoard'
import { Table } from './Table'

export function App() {
  const { game } = useGameEngine()
  if (!game) return <Lobby />
  if (game.phase === 'scored') return <ScoreBoard />
  return <Table />
}
