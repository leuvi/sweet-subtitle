import type { SubtitleFormat, SubtitleTrack, ASSTrack, VTTTrack, SBVTrack, TTMLTrack } from '../types'
import { parseSRT } from './srt'
import { parseVTT } from './vtt'
import { parseASS } from './ass'
import { parseSBV } from './sbv'
import { parseTTML } from './ttml'

export function parse(content: string, format?: SubtitleFormat): SubtitleTrack {
  const detected = format ?? detectFormat(content)
  switch (detected) {
    case 'srt': return parseSRT(content)
    case 'vtt': return parseVTT(content)
    case 'ass': return parseASS(content)
    case 'sbv': return parseSBV(content)
    case 'ttml': return parseTTML(content)
    default: throw new Error(`Unsupported subtitle format: ${detected}`)
  }
}

export function detectFormat(content: string): SubtitleFormat {
  const trimmed = content.trimStart()
  if (/^(?:<\?xml[\s\S]*?\?>\s*)?<(?:\w+:)?tt\b/i.test(trimmed)) return 'ttml'
  if (trimmed.startsWith('WEBVTT')) return 'vtt'
  if (trimmed.startsWith('[Script Info]') || /^\[.*Styles?\]/m.test(trimmed)) return 'ass'
  if (/^\d{1,2}:\d{2}:\d{2}\.\d{1,3}\s*,\s*\d{1,2}:\d{2}:\d{2}\.\d{1,3}/m.test(trimmed)) return 'sbv'
  if (/^\d+\s*\n\d{1,2}:\d{2}:\d{2}[,\.]\d{3}\s*-->/.test(trimmed)) return 'srt'
  if (/\d{1,2}:\d{2}:\d{2}[,\.]\d{3}\s*-->/.test(trimmed)) return 'srt'
  throw new Error('Unable to detect subtitle format')
}

export { parseSRT } from './srt'
export { parseVTT } from './vtt'
export { parseASS } from './ass'
export { parseSBV } from './sbv'
export { parseTTML } from './ttml'
export type { ASSTrack, VTTTrack, SBVTrack, TTMLTrack }
