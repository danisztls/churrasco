import { useEffect, useRef } from 'react'
import type { GameSnapshot } from '../game/types'
import { SFX } from './sfx'

interface Seen {
  round: number
  phase: string
  logLen: number
  myTurn: boolean
  pratos: number
}

/** Watches snapshot transitions and fires the matching sounds. */
export function useSfx(
  game: GameSnapshot | null,
  myId: string,
  myTurn: boolean
): void {
  const prev = useRef<Seen | null>(null)

  useEffect(() => {
    if (!game) {
      prev.current = null
      return
    }
    const seat = game.seats.find((s) => s.id === myId)
    const cur: Seen = {
      round: game.round,
      phase: game.phase,
      logLen: game.log.length,
      myTurn: game.phase === 'playing' && myTurn,
      // Race rules: the jingle marks MY claims, not recipes in hand.
      pratos: (game.pratoClaims ?? []).filter((c) => c.seat === myId).length
    }
    const p = prev.current
    prev.current = cur
    if (!p) return // first snapshot after join/refresh: stay silent

    if (cur.phase === 'scored' && p.phase !== 'scored') {
      SFX.gameOver()
      return
    }
    const roundChanged = cur.round > p.round
    if (roundChanged) {
      SFX.roundEnd()
      if (game.currentEvent) setTimeout(SFX.event, 380)
    } else {
      // Action feedback from the new log entries (skipped on round
      // transitions — the chime already marks them).
      const fresh = game.log.slice(p.logLen)
      if (fresh.some((e) => e.seat === seat?.name)) SFX.action()
      else if (fresh.length > 0) SFX.tick()
    }
    if (cur.pratos > p.pratos) setTimeout(SFX.prato, 150)
    if (cur.myTurn && !p.myTurn) SFX.yourTurn()
  }, [game, myId, myTurn])
}
