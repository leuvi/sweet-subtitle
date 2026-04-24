import type { SubtitleCue, SubtitleTrack } from '../types'

interface TTMLTimingContext {
  frameRate: number
  tickRate: number
}

export function parseTTML(content: string): SubtitleTrack {
  const clean = content.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const timing = getTimingContext(clean)
  const cues: SubtitleCue[] = []

  const cueRegex = /<(?:\w+:)?p\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?p>/gi
  let match: RegExpExecArray | null

  while ((match = cueRegex.exec(clean)) !== null) {
    const attrs = match[1] ?? ''
    const rawText = match[2] ?? ''

    const begin = getAttr(attrs, 'begin')
    const end = getAttr(attrs, 'end')
    const dur = getAttr(attrs, 'dur')
    if (!begin) continue

    const startSec = parseTTMLTime(begin, timing)
    if (!Number.isFinite(startSec)) continue

    let endSec = Number.NaN
    if (end) {
      endSec = parseTTMLTime(end, timing)
    } else if (dur) {
      const durSec = parseTTMLTime(dur, timing)
      if (Number.isFinite(durSec)) endSec = startSec + durSec
    }

    if (!Number.isFinite(endSec) || endSec <= startSec) continue

    const text = normalizeText(rawText)
    if (!text) continue

    cues.push({
      id: String(cues.length + 1),
      start: startSec,
      end: endSec,
      text,
    })
  }

  return { format: 'ttml', cues }
}

function getTimingContext(content: string): TTMLTimingContext {
  const ttTagMatch = content.match(/<(?:\w+:)?tt\b([^>]*)>/i)
  const attrs = ttTagMatch?.[1] ?? ''

  let frameRate = parseFloat(getAttr(attrs, 'frameRate') ?? '30')
  if (!Number.isFinite(frameRate) || frameRate <= 0) frameRate = 30

  const frameRateMultiplier = getAttr(attrs, 'frameRateMultiplier')
  if (frameRateMultiplier) {
    const [numRaw, denRaw] = frameRateMultiplier.trim().split(/\s+/)
    const num = parseFloat(numRaw)
    const den = parseFloat(denRaw)
    if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) {
      frameRate = frameRate * (num / den)
    }
  }

  let tickRate = parseFloat(getAttr(attrs, 'tickRate') ?? '')
  if (!Number.isFinite(tickRate) || tickRate <= 0) {
    tickRate = frameRate
  }

  return { frameRate, tickRate }
}

function parseTTMLTime(value: string, timing: TTMLTimingContext): number {
  const text = value.trim()
  if (!text) return Number.NaN

  const clock = text.match(/^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/)
  if (clock) {
    const h = parseInt(clock[1], 10)
    const m = parseInt(clock[2], 10)
    const s = parseInt(clock[3], 10)
    const ms = parseInt((clock[4] ?? '0').padEnd(3, '0').slice(0, 3), 10)
    return h * 3600 + m * 60 + s + ms / 1000
  }

  const frames = text.match(/^(\d{1,2}):(\d{2}):(\d{2}):(\d{1,2})$/)
  if (frames) {
    const h = parseInt(frames[1], 10)
    const m = parseInt(frames[2], 10)
    const s = parseInt(frames[3], 10)
    const f = parseInt(frames[4], 10)
    return h * 3600 + m * 60 + s + f / timing.frameRate
  }

  const shortClock = text.match(/^(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/)
  if (shortClock) {
    const m = parseInt(shortClock[1], 10)
    const s = parseInt(shortClock[2], 10)
    const ms = parseInt((shortClock[3] ?? '0').padEnd(3, '0').slice(0, 3), 10)
    return m * 60 + s + ms / 1000
  }

  const offset = text.match(/^([0-9]+(?:\.[0-9]+)?)(h|m|s|ms|f|t)$/)
  if (offset) {
    const num = parseFloat(offset[1])
    const unit = offset[2]
    if (!Number.isFinite(num)) return Number.NaN
    switch (unit) {
      case 'h': return num * 3600
      case 'm': return num * 60
      case 's': return num
      case 'ms': return num / 1000
      case 'f': return num / timing.frameRate
      case 't': return num / timing.tickRate
      default: return Number.NaN
    }
  }

  return Number.NaN
}

function getAttr(attrs: string, name: string): string | undefined {
  const escaped = name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
  const re = new RegExp(`(?:^|\\s)(?:\\w+:)?${escaped}\\s*=\\s*['\"]([^'\"]+)['\"]`, 'i')
  const match = attrs.match(re)
  return match?.[1]
}

function normalizeText(raw: string): string {
  const withLineBreaks = raw.replace(/<(?:\w+:)?br\s*\/?\s*>/gi, '\n')
  const noTags = withLineBreaks.replace(/<[^>]+>/g, '')
  const decoded = decodeEntities(noTags)
  return decoded
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
}
