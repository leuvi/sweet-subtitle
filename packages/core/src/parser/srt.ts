import type { SubtitleCue, SubtitleTrack } from '../types'

export function parseSRT(content: string): SubtitleTrack {
  const cues: SubtitleCue[] = []
  const clean = content.replace(/^﻿/, '').trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const blocks = clean.split(/\n\n+/)

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 2) continue

    let idx = 0
    let id = ''

    if (!lines[0].includes('-->')) {
      id = lines[0].trim()
      idx = 1
    }

    const timeLine = lines[idx]
    if (!timeLine) continue
    const timeMatch = timeLine.match(
      /(\d{1,2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,\.]\d{3})/
    )
    if (!timeMatch) continue

    const start = parseSRTTime(timeMatch[1])
    const end = parseSRTTime(timeMatch[2])
    const text = lines.slice(idx + 1).join('\n').trim()

    if (text) {
      cues.push({ id: id || String(cues.length + 1), start, end, text })
    }
  }

  return { format: 'srt', cues }
}

function parseSRTTime(time: string): number {
  const [hms, ms] = time.replace(',', '.').split('.')
  const parts = hms.split(':')
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  const s = parseInt(parts[2], 10)
  return h * 3600 + m * 60 + s + parseInt(ms, 10) / 1000
}
