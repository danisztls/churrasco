/**
 * Tiny Web Audio synth for game feedback — every sound is generated from
 * oscillators, no audio assets. Timbre notes: each tone is TWO slightly
 * detuned oscillators through a lowpass filter with a soft attack, which
 * reads "warm marimba-ish" instead of sharp chiptune. The master mute
 * persists in localStorage.
 */

let ctx: AudioContext | null = null
let master: GainNode | null = null

const STORAGE_KEY = 'churrasco-muted'
let muted =
  typeof localStorage !== 'undefined' &&
  localStorage.getItem(STORAGE_KEY) === '1'

function ensure(): { ctx: AudioContext; master: GainNode } | null {
  if (typeof AudioContext === 'undefined') return null
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = 0.18
    master.connect(ctx.destination)
  }
  // Browsers gate audio behind a user gesture; by the time game sounds fire
  // the player has clicked plenty, but resume defensively anyway.
  if (ctx.state === 'suspended') void ctx.resume()
  return { ctx, master: master! }
}

export function isMuted(): boolean {
  return muted
}

export function setMuted(v: boolean): void {
  muted = v
  localStorage.setItem(STORAGE_KEY, v ? '1' : '0')
}

/** One warm enveloped tone, `at` seconds from now. */
function tone(
  freq: number,
  at: number,
  dur: number,
  opts: { type?: OscillatorType; vol?: number; attack?: number } = {}
): void {
  const a = ensure()
  if (!a) return
  const { type = 'triangle', vol = 1, attack = 0.03 } = opts
  const t = a.ctx.currentTime + at

  const filter = a.ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(freq * 3, t)
  filter.Q.value = 0.6

  const gain = a.ctx.createGain()
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(vol, t + attack)
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur)

  // Two detuned voices — the slow beating rounds the tone off.
  for (const f of [freq, freq * 1.007]) {
    const osc = a.ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(f, t)
    osc.connect(filter)
    osc.start(t)
    osc.stop(t + dur + 0.03)
  }
  filter.connect(gain)
  gain.connect(a.master)
}

export const SFX = {
  /** Sua vez: rising major arpeggio, long enough to register alt-tabbed. */
  yourTurn(): void {
    if (muted) return
    tone(523, 0, 0.35, { vol: 0.55 })
    tone(659, 0.16, 0.35, { vol: 0.6 })
    tone(784, 0.32, 0.6, { vol: 0.65 })
  },
  /** Own action confirmed: rounded low tap. */
  action(): void {
    if (muted) return
    tone(240, 0, 0.12, { type: 'sine', vol: 0.5, attack: 0.012 })
  },
  /** A rival acted: tiny soft blip in the background. */
  tick(): void {
    if (muted) return
    tone(480, 0, 0.06, { type: 'sine', vol: 0.14, attack: 0.01 })
  },
  /** Round over: quiet low fifth — a page turn, not an alarm. */
  roundEnd(): void {
    if (muted) return
    tone(262, 0, 0.3, { type: 'sine', vol: 0.32 })
    tone(392, 0.1, 0.42, { type: 'sine', vol: 0.26 })
  },
  /** Event card revealed: slow minor swell, drama without harshness. */
  event(): void {
    if (muted) return
    tone(220, 0, 0.7, { vol: 0.3, attack: 0.16 })
    tone(262, 0.04, 0.7, { vol: 0.24, attack: 0.16 })
    tone(330, 0.08, 0.7, { vol: 0.2, attack: 0.16 })
  },
  /** Prato completed: warm rising arpeggio — the reward moment. */
  prato(): void {
    if (muted) return
    ;[523, 659, 784, 1047].forEach((f, i) =>
      tone(f, i * 0.11, i === 3 ? 0.5 : 0.28, { vol: 0.5 })
    )
  },
  /** Game over: little fanfare into the scoreboard. */
  gameOver(): void {
    if (muted) return
    ;[392, 523, 659, 784].forEach((f, i) =>
      tone(f, i * 0.15, i === 3 ? 0.8 : 0.3, { vol: 0.45 })
    )
  }
}
