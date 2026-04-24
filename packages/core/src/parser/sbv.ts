import type { SubtitleCue, SubtitleTrack } from '../types'

export function parseSBV(content: string): SubtitleTrack {
  const cues: SubtitleCue[] = []
  const clean = content.replace(/^﻿/, '').trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const blocks = clean.split(/\n\n+/)

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 2) continue

    const timeLine = lines[0]?.trim()
    if (!timeLine) continue

    const timeMatch = timeLine.match(
      /(\d{1,2}:\d{2}:\d{2}\.\d{1,3})\s*,\s*(\d{1,2}:\d{2}:\d{2}\.\d{1,3})/
    )
    if (!timeMatch) continue

    const start = parseSBVTime(timeMatch[1])
    const end = parseSBVTime(timeMatch[2])
    const text = lines.slice(1).join('\n').trim()

    if (text) {
      cues.push({ id: String(cues.length + 1), start, end, text })
    }
  }

  return { format: 'sbv', cues }
}

function parseSBVTime(time: string): number {
  const [hms, msRaw] = time.split('.')
  const parts = hms.split(':')
  if (parts.length !== 3) return 0

  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  const s = parseInt(parts[2], 10)
  const ms = parseInt((msRaw ?? '0').padEnd(3, '0').slice(0, 3), 10)

  return h * 3600 + m * 60 + s + ms / 1000
}
