import { describe, expect, it } from 'vitest'
import type { Acomp, Bebida, Card, Corte } from './types'
import { bebidaPlacements, scoreGame, scoreHand } from './scoring'

let nextId = 0
const carne = (corte: Corte): Card => ({ id: nextId++, kind: 'carne', corte })
const bebida = (b: Bebida): Card => ({
  id: nextId++,
  kind: 'bebida',
  bebida: b
})
const acomp = (a: Acomp): Card => ({ id: nextId++, kind: 'acomp', acomp: a })
const linguica = (): Card => ({ id: nextId++, kind: 'linguica' })
const pao = (): Card => ({ id: nextId++, kind: 'pao-de-alho' })
const abacaxi = (): Card => ({ id: nextId++, kind: 'abacaxi' })

const seat = (id: string, hand: Card[]) => ({
  id,
  name: id,
  hand,
  tookThisRound: false
})

describe('reference hands from the design doc (aferição rápida)', () => {
  it('carne + pão hand scores 21', () => {
    // [pão, picanha, costela, fraldinha, coração, coxão, linguiça]
    const hand = [
      pao(),
      carne('picanha'),
      carne('costela'),
      carne('fraldinha'),
      carne('coracao'),
      carne('coxao-duro'),
      linguica()
    ]
    const s = scoreHand(hand)
    expect(s.carne).toBe(15)
    expect(s.pao).toBe(5) // picanha doubled: 5 -> 10
    expect(s.linguica).toBe(1)
    expect(s.subtotal).toBe(21)
  })

  it('variedade hand scores 24 (5 distinct acomps + picanha + bebida)', () => {
    // Acomps/bebida chosen to not accidentally complete a prato.
    const hand = [
      acomp('vinagrete'),
      acomp('arroz'),
      acomp('feijao-tropeiro'),
      acomp('queijo-coalho'),
      acomp('mandioca'),
      carne('picanha'),
      bebida('guarana')
    ]
    const s = scoreHand(hand)
    expect(s.acomp).toBe(18)
    expect(s.carne).toBe(5)
    expect(s.bebidaFace).toBe(1)
    expect(s.pratos).toEqual([])
    expect(s.subtotal).toBe(24)
  })

  it('bebida hand scores 22 with 1º place (+8) in a 3-player game', () => {
    const a = seat('a', [
      bebida('cerveja'),
      bebida('guarana'),
      bebida('suco'),
      bebida('caipirinha'),
      carne('picanha'),
      carne('costela'),
      linguica()
    ])
    const b = seat('b', [bebida('cerveja'), carne('coracao')])
    const c = seat('c', [carne('coxao-duro')])
    const scores = scoreGame([a, b, c])
    expect(scores[0].bebidaPlacement).toBe(8)
    expect(scores[0].total).toBe(22) // 4 face + 8 + 5 + 4 + 1
    expect(scores[1].bebidaPlacement).toBe(4)
    expect(scores[2].bebidaPlacement).toBe(-4)
  })
})

describe('pão-de-alho binding', () => {
  it('does not retroact to cortes already in hand', () => {
    expect(scoreHand([carne('picanha'), pao()]).pao).toBe(0)
  })

  it('skips linguiça (not a corte)', () => {
    const s = scoreHand([pao(), linguica(), carne('costela')])
    expect(s.pao).toBe(4)
    expect(s.linguica).toBe(1)
  })

  it('one pão pairs one corte; a second pão waits for the next corte', () => {
    expect(scoreHand([pao(), pao(), carne('picanha')]).pao).toBe(5)
    expect(
      scoreHand([pao(), pao(), carne('picanha'), carne('coracao')]).pao
    ).toBe(7)
  })

  it('unpaired pão is worth 0', () => {
    expect(scoreHand([pao(), bebida('suco')]).subtotal).toBe(1)
  })
})

describe('linguiça curve (1/3/6 then +1 each)', () => {
  it.each([
    [0, 0],
    [1, 1],
    [2, 3],
    [3, 6],
    [4, 7],
    [5, 8],
    [6, 9],
    [7, 10]
  ])('%i linguiças -> %i points', (count, expected) => {
    const hand = Array.from({ length: count }, linguica)
    expect(scoreHand(hand).linguica).toBe(expected)
  })
})

describe('acompanhamentos (distinct types)', () => {
  it('repeated types do not count and carry no penalty', () => {
    const s = scoreHand([acomp('farofa'), acomp('farofa'), acomp('arroz')])
    expect(s.acomp).toBe(3) // 2 distinct
  })

  it('6 distinct scores 25; 7 distinct clamps at 25', () => {
    const six = [
      acomp('vinagrete'),
      acomp('arroz'),
      acomp('feijao-tropeiro'),
      acomp('queijo-coalho'),
      acomp('farofa'),
      acomp('maionese')
    ]
    expect(scoreHand(six).acomp).toBe(25)
    expect(scoreHand([...six, acomp('salada')]).acomp).toBe(25)
  })
})

describe('pratos', () => {
  it('exact triple fires and adds on top of card values', () => {
    const s = scoreHand([carne('picanha'), acomp('farofa'), bebida('cerveja')])
    expect(s.pratos).toEqual([{ name: 'Prato Raiz', bonus: 8 }])
    // 5 + 1 acomp + 1 bebida + 8 prato
    expect(s.subtotal).toBe(15)
  })

  it('one suco can serve two pratos (non-exclusive)', () => {
    const s = scoreHand([
      carne('fraldinha'),
      acomp('arroz'),
      bebida('suco'),
      carne('coxao-duro'),
      acomp('salada')
    ])
    expect(s.pratos.map((p) => p.name).sort()).toEqual([
      'Domingo em Família',
      'Fitness de Mentira'
    ])
    expect(s.pratosTotal).toBe(8)
  })
})

describe('bebida placement edge cases', () => {
  it('tie for 1st splits pooled 1º+2º bonuses, floored', () => {
    expect(bebidaPlacements([2, 2, 1])).toEqual([6, 6, -4])
  })

  it('tie for last: full penalty each, no bonus leaks to them', () => {
    expect(bebidaPlacements([3, 1, 1])).toEqual([8, -4, -4])
  })

  it('middle tie splits the remaining pool', () => {
    expect(bebidaPlacements([3, 2, 2, 1])).toEqual([8, 2, 2, -4])
  })

  it('all equal is a wash (including all zero)', () => {
    expect(bebidaPlacements([2, 2, 2])).toEqual([0, 0, 0])
    expect(bebidaPlacements([0, 0, 0])).toEqual([0, 0, 0])
  })
})

describe('abacaxi', () => {
  it('is worth 0', () => {
    expect(scoreHand([abacaxi(), abacaxi()]).subtotal).toBe(0)
  })
})
