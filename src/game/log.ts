import { scoreGame } from './scoring'
import type { Card, GameSnapshot } from './types'

/** Plain-text card label for logs/CSV (no emoji — see cardMeta for UI). */
export function cardLabel(card: Card): string {
  switch (card.kind) {
    case 'carne':
      return card.corte
    case 'bebida':
      return card.bebida
    case 'acomp':
      return card.acomp
    case 'linguica':
      return 'linguica'
    case 'pao-de-alho':
      return 'pao-de-alho'
    case 'abacaxi':
      return 'abacaxi'
  }
}

/** Decision log + final scores as CSV, for balance analysis after playtests. */
export function logToCsv(snap: GameSnapshot): string {
  const esc = (v: string | number | null | undefined) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
  }
  const rows: string[] = ['rodada,evento,jogador,acao,carta,opcoes']
  for (const e of snap.log) {
    rows.push(
      [e.round, e.event, e.seat, e.action, e.card, e.options].map(esc).join(',')
    )
  }
  if (snap.phase === 'scored') {
    for (const s of scoreGame(snap.seats)) {
      rows.push(
        [
          snap.round,
          '',
          s.name,
          'total',
          `carne=${s.carne + s.pao};linguica=${s.linguica};acomp=${s.acomp};bebida=${s.bebidaFace + s.bebidaPlacement};pratos=${s.pratosTotal}`,
          s.total
        ]
          .map(esc)
          .join(',')
      )
    }
  }
  return rows.join('\n') + '\n'
}
