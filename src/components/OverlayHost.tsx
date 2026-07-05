import { useEffect, useState } from 'react'

export interface Announcement {
  emoji: string
  title: string
  desc?: string
}

const SHOW_MS = 2000
const FADE_MS = 450

const queue: Announcement[] = []
let poke: (() => void) | null = null

/** Fire-and-forget center-screen notice (event of the round, prato feito,
 * ...). Announcements queue up and show one at a time. */
export function announce(a: Announcement): void {
  queue.push(a)
  poke?.()
}

export function OverlayHost() {
  const [current, setCurrent] = useState<Announcement | null>(null)
  const [fading, setFading] = useState(false)
  const [, bump] = useState(0)

  useEffect(() => {
    poke = () => bump((x) => x + 1)
    return () => {
      poke = null
    }
  }, [])

  // Dequeue whenever idle (cheap guard, runs per render).
  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue.shift()!)
      setFading(false)
    }
  })

  // Lifecycle of the one being shown: hold, fade, clear.
  useEffect(() => {
    if (!current) return
    const t1 = window.setTimeout(() => setFading(true), SHOW_MS)
    const t2 = window.setTimeout(() => setCurrent(null), SHOW_MS + FADE_MS)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [current])

  if (!current) return null
  return (
    <div className={`overlay-note${fading ? ' overlay-fade' : ''}`}>
      <span className="overlay-emoji">{current.emoji}</span>
      <strong>{current.title}</strong>
      {current.desc && <span className="overlay-desc">{current.desc}</span>}
    </div>
  )
}
