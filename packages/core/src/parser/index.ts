import type { SubtitleFormat, SubtitleTrack, ASSTrack, VTTTrack } from '../types'
import { parseSRT } from './srt'
import { parseVTT } from './vtt'
import { parseASS } from './ass'

export function parse(content: string, format?: SubtitleFormat): SubtitleTrack {
  const detected = format ?? detectFormat(content)
  switch (detected) {
    case 'srt': return parseSRT(content)
    case 'vtt': return parseVTT(content)
    case 'ass': return parseASS(content)
    default: throw new Error(`Unsupported subtitle format: ${detected}`)
  }
}

export function detectFormat(content: string): SubtitleFormat {
  const trimmed = content.trimStart()
  if (trimmed.startsWith('WEBVTT')) return 'vtt'
  if (trimmed.startsWith('[Script Info]') || /^\[.*Styles?\]/m.test(trimmed)) return 'ass'
  if (/^\d+\s*\n\d{1,2}:\d{2}:\d{2}[,\.]\d{3}\s*-->/.test(trimmed)) return 'srt'
  if (/\d{1,2}:\d{2}:\d{2}[,\.]\d{3}\s*-->/.test(trimmed)) return 'srt'
  throw new Error('Unable to detect subtitle format')
}

export { parseSRT } from './srt'
export { parseVTT } from './vtt'
export { parseASS } from './ass'
export type { ASSTrack, VTTTrack }
