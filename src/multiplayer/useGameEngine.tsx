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
    const seats = players.map((p) => ({
      id: p.id,
      name: p.getProfile().name,
      color: p.getProfile().color?.hexString
    }))
    setGame(newGame(seats, Date.now() >>> 0), true)
  }, [players, setGame])

  // Host auto-pilot: if the seat on turn belongs to a disconnected player,
  // play a safe move for them (reveal, then take the first face-up card)
  // so one dropout doesn't deadlock the table.
  useEffect(() => {
    if (!amHost || !game || game.phase !== 'playing') return
    const seatId = game.seats[game.turnSeat].id
    if (players.some((p) => p.id === seatId)) return
    const timer = setTimeout(() => {
      const snap = getState('game') as GameSnapshot | null
      if (!snap || snap.phase !== 'playing') return
      const turnId = snap.seats[snap.turnSeat].id
      if (getParticipants()[turnId]) return // reconnected meanwhile
      const moves = legalMoves(snap)
      const move =
        moves.find((m) => m.type === 'reveal') ??
        moves.find((m) => m.type === 'take')
      if (move) hostApply(turnId, move)
    }, 1500)
    return () => clearTimeout(timer)
  }, [amHost, game, players, hostApply])

  const myTurn =
    game?.phase === 'playing' && game.seats[game.turnSeat]?.id === me.id
  const myMoves = myTurn && game ? legalMoves(game) : []

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
