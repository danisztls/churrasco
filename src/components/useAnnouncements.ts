import { useEffect, useRef } from 'react'
import { CONFIG } from '../game/config'
import { EVENTS } from '../game/events'
import type { GameSnapshot } from '../game/types'
import { announce } from './OverlayHost'

/** Watches snapshot transitions and pushes overlay notices: the event card
 * opening each round, and prato claims (mine AND rivals' — it's a race, a
 * rival's claim is table information). */
export function useAnnouncements(game: GameSnapshot | null, myId: string) {
  const prevRound = useRef(0)
  const prevClaims = useRef<number | null>(null)

  useEffect(() => {
    if (!game) {
      prevRound.current = 0
      prevClaims.current = null
      return
    }
    const claims = game.pratoClaims ?? []

    // prevRound 0 = just joined/refreshed: stay silent on stale state.
    if (
      prevRound.current > 0 &&
      game.round > prevRound.current &&
      game.currentEvent
    ) {
      const ev = EVENTS[game.currentEvent]
      announce({ emoji: ev.emoji, title: ev.name, desc: ev.desc })
    }
    if (prevClaims.current !== null) {
      for (const claim of claims.slice(prevClaims.current)) {
        const bonus =
          CONFIG.pratos.find((p) => p.name === claim.name)?.bonus ?? 0
        if (claim.seat === myId) {
          announce({
            emoji: '⭐',
            title: `${claim.name}!`,
            desc: `Você levou o prato: +${bonus} pontos`
          })
        } else {
          const rival = game.seats.find((s) => s.id === claim.seat)
          announce({
            emoji: '🏁',
            title: `${rival?.name ?? '?'} levou ${claim.name}`,
            desc: `+${bonus} para ele — prato fora da corrida`
          })
        }
      }
    }
    prevRound.current = game.round
    prevClaims.current = claims.length
  }, [game, myId])
}
