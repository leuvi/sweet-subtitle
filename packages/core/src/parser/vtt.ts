import type { SubtitleCue, VTTCueSettings, VTTRegion, VTTTrack } from '../types'

export function parseVTT(content: string): VTTTrack {
  const normalized = content.replace(/^﻿/, '').trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  if (!normalized.startsWith('WEBVTT')) {
    throw new Error('Invalid WebVTT: missing WEBVTT header')
  }

  const cues: SubtitleCue[] = []
  const regions: VTTRegion[] = []
  const styles: string[] = []

  const headerEnd = normalized.indexOf('\n\n')
  const body = headerEnd === -1 ? '' : normalized.slice(headerEnd + 2)
  const blocks = body.split(/\n\n+/)

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length === 0) continue

    if (lines[0].startsWith('REGION')) {
      const region = parseRegion(lines.slice(1))
      if (region) regions.push(region)
      continue
    }

    if (lines[0].startsWith('STYLE')) {
      styles.push(lines.slice(1).join('\n'))
      continue
    }

    if (lines[0].startsWith('NOTE')) continue

    let idx = 0
    let id = ''

    if (!lines[0].includes('-->')) {
      id = lines[0].trim()
      idx = 1
    }

    const timeLine = lines[idx]
    if (!timeLine?.includes('-->')) continue

    const timeMatch = timeLine.match(
      /(\d{1,2}:?\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{1,2}:?\d{2}:\d{2}\.\d{3})(.*)?/
    )
    if (!timeMatch) continue

    const start = parseVTTTime(timeMatch[1])
    const end = parseVTTTime(timeMatch[2])
    const settingsStr = timeMatch[3]?.trim()
    const settings = settingsStr ? parseCueSettings(settingsStr) : undefined
    const text = lines.slice(idx + 1).join('\n').trim()

    if (text) {
      const cue: SubtitleCue & { format: 'vtt'; settings?: VTTCueSettings } = {
        id: id || String(cues.length + 1),
        start,
        end,
        text,
        format: 'vtt',
        settings,
      }
      cues.push(cue)
    }
  }

  return { format: 'vtt', cues, regions, styles }
}

function parseVTTTime(time: string): number {
  const parts = time.split(':')
  if (parts.length === 3) {
    const h = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10)
    const [s, ms] = parts[2].split('.')
    return h * 3600 + m * 60 + parseInt(s, 10) + parseInt(ms, 10) / 1000
  }
  const m = parseInt(parts[0], 10)
  const [s, ms] = parts[1].split('.')
  return m * 60 + parseInt(s, 10) + parseInt(ms, 10) / 1000
}

function parseCueSettings(str: string): VTTCueSettings {
  const settings: VTTCueSettings = {}
  const pairs = str.split(/\s+/)
  for (const pair of pairs) {
    const [key, value] = pair.split(':')
    if (!key || !value) continue
    switch (key) {
      case 'vertical': settings.vertical = value as 'rl' | 'lr'; break
      case 'line': settings.line = value; break
      case 'position': settings.position = value; break
      case 'size': settings.size = value; break
      case 'align': settings.align = value as VTTCueSettings['align']; break
      case 'region': settings.region = value; break
    }
  }
  return settings
}

function parseRegion(lines: string[]): VTTRegion | null {
  const region: Partial<VTTRegion> = {}
  for (const line of lines) {
    const [key, value] = line.split(':').map(s => s.trim())
    if (!key || !value) continue
    switch (key) {
      case 'id': region.id = value; break
      case 'width': region.width = parseFloat(value); break
      case 'lines': region.lines = parseInt(value, 10); break
      case 'regionanchor': {
        const [x, y] = value.split(',').map(Number)
        region.regionAnchorX = x
        region.regionAnchorY = y
        break
      }
      case 'viewportanchor': {
        const [x, y] = value.split(',').map(Number)
        region.viewportAnchorX = x
        region.viewportAnchorY = y
        break
      }
      case 'scroll': region.scroll = value as 'up'; break
    }
  }
  if (!region.id) return null
  return {
    id: region.id,
    width: region.width ?? 100,
    lines: region.lines ?? 3,
    regionAnchorX: region.regionAnchorX ?? 0,
    regionAnchorY: region.regionAnchorY ?? 100,
    viewportAnchorX: region.viewportAnchorX ?? 0,
    viewportAnchorY: region.viewportAnchorY ?? 100,
    scroll: region.scroll,
  }
}
