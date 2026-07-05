import {
  getParticipants,
  getState,
  isHost,
  myPlayer,
  RPC,
  useIsHost,
  useMultiplayerState,
  usePlayersList
} from 'playroomkit'
import type { PlayerState } from 'playroomkit'
import React, { createContext, useCallback, useContext, useEffect } from 'react'
import { BOT_SEATS, botMove } from '../game/bot'
import { CONFIG } from '../game/config'
import { applyMove, legalMoves, newGame } from '../game/rules'
import type { GameSnapshot, Move } from '../game/types'

/**
 * Host-authoritative sync: the whole GameSnapshot lives under one synced key.
 * The host is the only writer — it validates every move through the pure
 * rules module and publishes the resulting snapshot. Other players send
 * moves over RPC. Because full state is synced (not host memory), host
 * migration and late joins keep working.
 */

interface GameEngine {
  game: GameSnapshot | null
  players: PlayerState[]
  me: PlayerState
  amHost: boolean
  /** Legal moves when it's my turn, [] otherwise. */
  myMoves: Move[]
  dispatch: (move: Move) => void
  startGame: () => void
}

const GameEngineContext = createContext<GameEngine | null>(null)

export function GameEngineProvider({
  children
}: {
  children: React.ReactNode
}) {
  const [game, setGame] = useMultiplayerState<GameSnapshot | null>('game', null)
  const players = usePlayersList()
  const amHost = useIsHost()
  const me = myPlayer()

  const hostApply = useCallback(
    (playerId: string, move: Move) => {
      const snap = getState('game') as GameSnapshot | null
      if (!snap) return
      try {
        setGame(applyMove(snap, playerId, move), true)
      } catch (err) {
        console.warn('[churrasco] jogada ilegal ignorada', move, err)
      }
    },
    [setGame]
  )

  // Every client registers the handler; only the host receives HOST-mode calls.
  useEffect(() => {
    return RPC.register('move', async (move: Move, caller) => {
      if (isHost()) hostApply(caller.id, move)
    })
  }, [hostApply])

  const dispatch = useCallback(
    (move: Move) => {
      if (isHost()) hostApply(myPlayer().id, move)
      else RPC.call('move', move, RPC.Mode.HOST)
    },
    [hostApply]
  )

  const startGame = useCallback(() => {
    if (!isHost()) return
    const botCount = (getState('bots') as number) || 0
    const seats = [
      ...players.map((p) => ({
        id: p.id,
        name: p.getProfile().name,
        color: p.getProfile().color?.hexString
      })),
      ...BOT_SEATS.slice(0, botCount)
    ]
    setGame(newGame(seats, Date.now() >>> 0), true)
  }, [players, setGame])

  // Host auto-pilot: bot seats and disconnected players get their moves
  // played by the greedy bot after a short beat; connected humans get
  // CONFIG.turnTimeoutSec of inactivity before the table plays for them.
  // Any snapshot change re-arms the timer.
  useEffect(() => {
    if (!amHost || !game || game.phase !== 'playing') return
    const actors = game.seats.filter(
      (seat) => legalMoves(game, seat.id).length > 0
    )
    if (actors.length === 0) return
    const unattended = actors.filter(
      (seat) => !players.some((p) => p.id === seat.id)
    )
    const timedOut = unattended.length === 0
    const delay = timedOut
      ? CONFIG.turnTimeoutSec * 1000
      : unattended.some((s) => s.id.startsWith('bot-'))
        ? 900
        : 1500
    const timer = setTimeout(() => {
      const snap = getState('game') as GameSnapshot | null
      if (!snap || snap.phase !== 'playing') return
      // Connected set at fire time — the local player explicitly, since
      // getParticipants() may not include self.
      const connected = new Set([
        myPlayer().id,
        ...Object.keys(getParticipants())
      ])
      for (const seat of snap.seats) {
        if (connected.has(seat.id)) continue
        const move = botMove(snap, seat.id, Math.random)
        if (move) {
          hostApply(seat.id, move)
          return // one per tick; the state change re-triggers this effect
        }
      }
      // Timeout path only: everyone pending is connected but idle — play
      // for the first of them.
      if (!timedOut) return
      for (const seat of snap.seats) {
        const move = botMove(snap, seat.id, Math.random)
        if (move) {
          hostApply(seat.id, move)
          return
        }
      }
    }, delay)
    return () => clearTimeout(timer)
  }, [amHost, game, players, hostApply])

  const myMoves = game ? legalMoves(game, me.id) : []

  return (
    <GameEngineContext.Provider
      value={{ game, players, me, amHost, myMoves, dispatch, startGame }}
    >
      {children}
    </GameEngineContext.Provider>
  )
}

export function useGameEngine(): GameEngine {
  const ctx = useContext(GameEngineContext)
  if (!ctx)
    throw new Error('useGameEngine deve ser usado dentro de GameEngineProvider')
  return ctx
}
