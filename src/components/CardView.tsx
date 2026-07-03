import type { Card } from '../game/types'
import { cardMeta } from './cardMeta'

export function CardView({
  card,
  small,
  selected,
  clickable,
  onClick
}: {
  card: Card
  small?: boolean
  selected?: boolean
  clickable?: boolean
  onClick?: () => void
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
    <button type="button" className={cls} onClick={onClick} disabled={!onClick}>
      <span className="card-emoji">{meta.emoji}</span>
      <span className="card-name">{meta.name}</span>
      {!small && <span className="card-rule">{meta.rule}</span>}
    </button>
  )
}

export function CardBack({
  clickable,
  onClick
}: {
  clickable?: boolean
  onClick?: () => void
}) {
  const cls = ['card', 'card-back', clickable && 'card-clickable']
    .filter(Boolean)
    .join(' ')
  return (
    <button type="button" className={cls} onClick={onClick} disabled={!onClick}>
      <span className="card-emoji">🔥</span>
      <span className="card-name">Churrasco</span>
    </button>
  )
}
