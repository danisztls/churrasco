import type { Card } from '../game/types'
import { cardMeta, cardTooltip } from './cardMeta'

export function CardView({
  card,
  small,
  selected,
  clickable,
  onClick,
  points
}: {
  card: Card
  small?: boolean
  selected?: boolean
  clickable?: boolean
  onClick?: () => void
  /** Current contribution to the hand score, shown as a corner badge. */
  points?: number
}) {
  const meta = cardMeta(card)
  const cls = [
    'card',
    `card-${meta.kind}`,
    small && 'card-small',
    selected && 'card-selected',
    clickable && 'card-clickable'
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      disabled={!onClick}
      data-tip={cardTooltip(card)}
    >
      {points !== undefined && (
        <span
          className={`card-points${points === 0 ? ' card-points-zero' : ''}`}
        >
          {points > 0 ? `+${points}` : '0'}
        </span>
      )}
      <span className="card-emoji">{meta.emoji}</span>
      <span className="card-name">{meta.name}</span>
      {!small && <span className="card-rule">{meta.rule}</span>}
    </button>
  )
}

export function CardBack() {
  return (
    <button
      type="button"
      className="card card-back"
      disabled
      data-tip="Carta virada para baixo."
    >
      <span className="card-emoji">🔥</span>
      <span className="card-name">Churrasco</span>
    </button>
  )
}
