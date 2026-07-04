import { EVENTS } from '../game/events'
import type { GameSnapshot, LogEntry } from '../game/types'
import { labelName } from './cardMeta'

function lineFor(e: LogEntry): string {
  const card = e.card ? labelName(e.card) : ''
  switch (e.action) {
    case 'pegou':
      return `${e.seat} pegou ${card}`
    case 'passou':
      return `${e.seat} passou`
    case 'abacaxi':
      return `${e.seat} trocou o abacaxi por ${card}`
    case 'descartou':
      return `${e.seat} descartou ${card}`
    case 'presenteou':
      return `${e.seat} deu ${card} de presente`
    case 'trocou':
      return `${e.seat} deu ${card} na troca`
    case 'sobras':
      return `${e.seat} pôs ${card} no monte`
    case 'queimou':
      return `o buffet pegou fogo (${e.options} cartas queimadas)`
  }
}

export function GameLog({ game }: { game: GameSnapshot }) {
  if (game.log.length === 0) return null
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
            {lineFor(e)}
          </li>
        ))}
      </ul>
    </aside>
  )
}
