/**
 * Tiny Web Audio synth for game feedback — every sound is generated from
 * oscillators, no audio assets. Volumes are gentle by design; the master
 * mute persists in localStorage.
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
    master.gain.value = 0.2
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

/** One enveloped oscillator note, `at` seconds from now. */
function note(
  freq: number,
  at: number,
  dur: number,
  type: OscillatorType = 'sine',
  vol = 1
): void {
  const a = ensure()
  if (!a) return
  const t = a.ctx.currentTime + at
  const osc = a.ctx.createOscillator()
  const gain = a.ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(vol, t + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
  osc.connect(gain)
  gain.connect(a.master)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

export const SFX = {
  /** Sua vez: two rising notes, hard to miss even alt-tabbed. */
  yourTurn(): void {
    if (muted) return
    note(660, 0, 0.12, 'triangle', 0.9)
    note(880, 0.11, 0.24, 'triangle', 0.9)
  },
  /** Own action confirmed: short thock. */
  action(): void {
    if (muted) return
    note(320, 0, 0.09, 'square', 0.45)
  },
  /** A rival acted: soft tick, keeps the table alive in the background. */
  tick(): void {
    if (muted) return
    note(520, 0, 0.05, 'sine', 0.22)
  },
  /** Round over: three-note descending resolve. */
  roundEnd(): void {
    if (muted) return
    note(587, 0, 0.12, 'triangle', 0.7)
    note(494, 0.12, 0.12, 'triangle', 0.7)
    note(392, 0.24, 0.3, 'triangle', 0.7)
  },
  /** Event card revealed: dissonant little sting. */
  event(): void {
    if (muted) return
    note(220, 0, 0.42, 'sawtooth', 0.4)
    note(233, 0.02, 0.42, 'sawtooth', 0.32)
  },
  /** Prato completed: rising arpeggio — the reward moment. */
  prato(): void {
    if (muted) return
    ;[523, 659, 784, 1047].forEach((f, i) =>
      note(f, i * 0.09, i === 3 ? 0.3 : 0.16, 'triangle', 0.8)
    )
  },
  /** Game over: little fanfare into the scoreboard. */
  gameOver(): void {
    if (muted) return
    ;[392, 523, 659, 784].forEach((f, i) =>
      note(f, i * 0.13, i === 3 ? 0.55 : 0.15, 'square', 0.4)
    )
  }
}
