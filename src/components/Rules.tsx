import { ACOMP_TYPES, CONFIG } from '../game/config'
import { EVENTS } from '../game/events'
import { reqMeta } from './cardMeta'

const CORTE_NAMES: Record<string, string> = {
  picanha: 'Picanha',
  costela: 'Costela',
  fraldinha: 'Fraldinha',
  coracao: 'Coração',
  'coxao-duro': 'Coxão Duro'
}

export function Rules({ onClose }: { onClose: () => void }) {
  return (
    <div className="rules-overlay" onClick={onClose}>
      <div className="rules-panel" onClick={(e) => e.stopPropagation()}>
        <div className="rules-header">
          <h2>Como jogar 🔥</h2>
          <button type="button" className="btn" onClick={onClose}>
            Fechar
          </button>
        </div>

        <h3>Objetivo</h3>
        <p>
          Monte o melhor prato: o jogo acaba quando todos tiverem{' '}
          {CONFIG.handSize} cartas. Maior pontuação vence.
        </p>

        <h3>Sua vez</h3>
        <p>
          O buffet tem 2 cartas por jogador. Na sua vez, uma carta fechada vira
          sozinha; então <strong>pegue</strong> qualquer carta aberta (e saia da
          rodada) — ou <strong>passe</strong> e espere corte melhor. Só dá para
          passar enquanto houver carta fechada. O que sobra abre a rodada
          seguinte.
        </p>

        <h3>Pontuação</h3>
        <ul>
          <li>
            🥩 <strong>Carne</strong>: valor de face —{' '}
            {Object.entries(CONFIG.cortePoints)
              .map(([c, p]) => `${CORTE_NAMES[c]} ${p}`)
              .join(' · ')}
          </li>
          <li>
            🧄 <strong>Pão de Alho</strong>: dobra o <em>próximo</em> corte que
            você pegar (não retroage; sem corte depois, vale 0)
          </li>
          <li>
            🌭 <strong>Linguiça</strong>: iguais —{' '}
            {CONFIG.linguicaCurve.slice(1).join('/')}, depois +1 cada
          </li>
          <li>
            🥗 <strong>Acompanhamentos</strong> ({ACOMP_TYPES.length} tipos):
            distintos — {CONFIG.acompCurve.slice(1).join('/')}
          </li>
          <li>
            🍺 <strong>Bebida</strong>: {CONFIG.bebidaFace} pt cada; no fim,
            quem tem mais ganha +{CONFIG.bebidaPlacementBonus[0]}, 2º +
            {CONFIG.bebidaPlacementBonus[1]}, quem tem menos leva{' '}
            {CONFIG.bebidaLastPenalty}
          </li>
          <li>
            🍍 <strong>Abacaxi</strong>: 0 pts — ação grátis: na sua vez,
            troque-o por uma carta aberta do buffet e ainda pegue ou passe no
            mesmo turno (vale até com tudo revelado)
          </li>
        </ul>

        <h3>Pratos (bônus por receita exata na mão)</h3>
        <ul>
          {CONFIG.pratos.map((p) => (
            <li key={p.name}>
              <strong>{p.name}</strong> (+{p.bonus}):{' '}
              {p.reqs.map((r) => reqMeta(r).name).join(' + ')}
            </li>
          ))}
        </ul>

        <h3>Eventos (1 por rodada, a partir da 2ª)</h3>
        <ul>
          {Object.values(EVENTS).map((ev) => (
            <li key={ev.name}>
              {ev.emoji} <strong>{ev.name}</strong> — {ev.desc}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
