import { useEffect, useRef } from 'react'
import { CONFIG } from '../game/config'
import { EVENTS } from '../game/events'
import { scoreHand } from '../game/scoring'
import type { GameSnapshot } from '../game/types'
import { announce } from './OverlayHost'

/** Watches snapshot transitions and pushes overlay notices: the event card
 * opening each round, and pratos the local player completes. */
export function useAnnouncements(game: GameSnapshot | null, myId: string) {
  const prevRound = useRef(0)
  const prevPratos = useRef<string[] | null>(null)

  useEffect(() => {
    if (!game) {
      prevRound.current = 0
      prevPratos.current = null
      return
    }
    const seat = game.seats.find((s) => s.id === myId)
    const pratos = seat ? scoreHand(seat.hand).pratos.map((p) => p.name) : []

    // prevRound 0 = just joined/refreshed: stay silent on stale state.
    if (
      prevRound.current > 0 &&
      game.round > prevRound.current &&
      game.currentEvent
    ) {
      const ev = EVENTS[game.currentEvent]
      announce({ emoji: ev.emoji, title: ev.name, desc: ev.desc })
    }
    if (prevPratos.current) {
      for (const name of pratos) {
        if (!prevPratos.current.includes(name)) {
          const p = CONFIG.pratos.find((x) => x.name === name)
          announce({
            emoji: '⭐',
            title: `${name}!`,
            desc: `Prato completo: +${p?.bonus ?? 0} pontos`
          })
        }
      }
    }
    prevRound.current = game.round
    prevPratos.current = pratos
  }, [game, myId])
}
