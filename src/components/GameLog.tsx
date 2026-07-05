import { EVENTS } from '../game/events'
import type { GameSnapshot, LogEntry } from '../game/types'
import { labelKind, labelName } from './cardMeta'

function LogLine({ e, color }: { e: LogEntry; color?: string }) {
  const seat = <strong style={color ? { color } : undefined}>{e.seat}</strong>
  const card = e.card ? (
    <span className={`log-card log-${labelKind(e.card)}`}>
      {labelName(e.card)}
    </span>
  ) : null
  switch (e.action) {
    case 'pegou':
      return (
        <>
          {seat} pegou {card}
        </>
      )
    case 'passou':
      return <>{seat} passou</>
    case 'abacaxi':
      return (
        <>
          {seat} trocou o abacaxi por {card}
        </>
      )
    case 'descartou':
      return (
        <>
          {seat} descartou {card}
        </>
      )
    case 'presenteou':
      return (
        <>
          {seat} deu {card} de presente
        </>
      )
    case 'trocou':
      return (
        <>
          {seat} deu {card} na troca
        </>
      )
    case 'sobras':
      return (
        <>
          {seat} pôs {card} no monte
        </>
      )
  }
}

export function GameLog({ game }: { game: GameSnapshot }) {
  if (game.log.length === 0) return null
  const colorOf = new Map(game.seats.map((s) => [s.name, s.color]))
  return (
    <aside className="game-log">
      <div className="hand-header">
        <span>Histórico</span>
      </div>
      <ul>
        {[...game.log].reverse().map((e, i) => (
          <li key={game.log.length - i}>
            <span className="log-round">
              R{e.round}
              {e.event ? EVENTS[e.event].emoji : ''}
            </span>{' '}
            <LogLine e={e} color={colorOf.get(e.seat)} />
          </li>
        ))}
      </ul>
    </aside>
  )
}
