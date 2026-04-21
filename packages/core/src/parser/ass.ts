import type {
  ASSColor,
  ASSDialogue,
  ASSOverrideBlock,
  ASSOverrideTag,
  ASSScriptInfo,
  ASSStyle,
  ASSTrack,
  ASSAnimation,
  SubtitleCue,
} from '../types'

export function parseASS(content: string): ASSTrack {
  const normalized = content.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const sections = splitSections(normalized)

  const scriptInfo = parseScriptInfo(
    sections['Script Info'] ?? sections['script info'] ?? ''
  )
  const styles = parseStyles(
    sections['V4+ Styles'] ?? sections['V4 Styles'] ??
    sections['v4+ styles'] ?? sections['v4 styles'] ?? ''
  )
  const dialogues = parseEvents(
    sections['Events'] ?? sections['events'] ?? ''
  )

  const cues: SubtitleCue[] = dialogues.map((d, i) => ({
    id: String(i + 1),
    start: d.start,
    end: d.end,
    text: d.text.replace(/\\N/g, '\n').replace(/\\n/g, '\n').replace(/\{[^}]*\}/g, ''),
    layer: d.layer,
  }))

  return { format: 'ass', cues, scriptInfo, styles, dialogues }
}

function splitSections(content: string): Record<string, string> {
  const sections: Record<string, string> = {}
  let currentSection = ''
  const lines = content.split('\n')

  for (const line of lines) {
    const sectionMatch = line.match(/^\[(.+?)\]\s*$/)
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim()
      sections[currentSection] = ''
      sections[currentSection.toLowerCase()] = ''
      continue
    }
    if (currentSection) {
      sections[currentSection] += line + '\n'
      sections[currentSection.toLowerCase()] += line + '\n'
    }
  }

  return sections
}

function parseScriptInfo(content: string): ASSScriptInfo {
  const info: ASSScriptInfo = { playResX: 0, playResY: 0 }

  for (const line of content.split('\n')) {
    if (line.startsWith(';') || !line.trim()) continue
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const value = line.slice(colonIdx + 1).trim()

    switch (key) {
      case 'Title': info.title = value; break
      case 'Original Script': info.originalScript = value; break
      case 'ScriptType': info.scriptType = value; break
      case 'Collisions': info.collisions = value; break
      case 'PlayResX': info.playResX = parseInt(value, 10) || 0; break
      case 'PlayResY': info.playResY = parseInt(value, 10) || 0; break
      case 'Timer': info.timer = parseFloat(value) || 100; break
      case 'WrapStyle': info.wrapStyle = parseInt(value, 10); break
      case 'ScaledBorderAndShadow': info.scaledBorderAndShadow = value.toLowerCase() === 'yes'; break
      case 'YCbCr Matrix': info.ycbcrMatrix = value; break
      default: info[key] = value
    }
  }

  if (!info.playResX && !info.playResY) {
    info.playResX = 384
    info.playResY = 288
  } else if (!info.playResX) {
    info.playResX = Math.round(info.playResY * 4 / 3)
  } else if (!info.playResY) {
    info.playResY = Math.round(info.playResX * 3 / 4)
  }

  return info
}

const DEFAULT_STYLE_FORMAT = ['Name', 'Fontname', 'Fontsize', 'PrimaryColour', 'SecondaryColour', 'OutlineColour', 'BackColour', 'Bold', 'Italic', 'Underline', 'StrikeOut', 'ScaleX', 'ScaleY', 'Spacing', 'Angle', 'BorderStyle', 'Outline', 'Shadow', 'Alignment', 'MarginL', 'MarginR', 'MarginV', 'Encoding']

function parseStyles(content: string): ASSStyle[] {
  const styles: ASSStyle[] = []
  let formatFields: string[] = []

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('Format:')) {
      const parsed = trimmed.slice(7).split(',').map(s => s.trim())
      if (parsed.includes('Name') && parsed.includes('Fontname')) {
        formatFields = parsed
      } else {
        formatFields = DEFAULT_STYLE_FORMAT
      }
      continue
    }
    if (trimmed.startsWith('Style:')) {
      if (formatFields.length === 0) formatFields = DEFAULT_STYLE_FORMAT
      const values = splitStyleLine(trimmed.slice(6).trim(), formatFields.length)
      if (values.length < formatFields.length) continue

      const map: Record<string, string> = {}
      formatFields.forEach((f, i) => { map[f] = values[i].trim() })

      styles.push({
        name: map['Name'] ?? '',
        fontname: map['Fontname'] ?? 'Arial',
        fontsize: parseInt(map['Fontsize'], 10) || 20,
        primaryColor: parseASSColor(map['PrimaryColour'] ?? '&H00FFFFFF'),
        secondaryColor: parseASSColor(map['SecondaryColour'] ?? '&H00000000'),
        outlineColor: parseASSColor(map['OutlineColour'] ?? '&H00000000'),
        backColor: parseASSColor(map['BackColour'] ?? '&H00000000'),
        bold: map['Bold'] === '-1' || map['Bold'] === '1',
        italic: map['Italic'] === '-1' || map['Italic'] === '1',
        underline: map['Underline'] === '-1' || map['Underline'] === '1',
        strikeOut: map['StrikeOut'] === '-1' || map['StrikeOut'] === '1',
        scaleX: parseFloat(map['ScaleX']) || 100,
        scaleY: parseFloat(map['ScaleY']) || 100,
        spacing: parseFloat(map['Spacing']) || 0,
        angle: parseFloat(map['Angle']) || 0,
        borderStyle: parseInt(map['BorderStyle'], 10) || 1,
        outline: parseFloat(map['Outline']) || 0,
        shadow: parseFloat(map['Shadow']) || 0,
        alignment: parseInt(map['Alignment'], 10) || 2,
        marginL: parseInt(map['MarginL'], 10) || 0,
        marginR: parseInt(map['MarginR'], 10) || 0,
        marginV: parseInt(map['MarginV'], 10) || 0,
        encoding: parseInt(map['Encoding'], 10) || 0,
      })
    }
  }

  return styles
}

function splitStyleLine(line: string, expectedCount: number): string[] {
  const parts: string[] = []
  let start = 0
  for (let i = 0; i < expectedCount - 1; i++) {
    const commaIdx = line.indexOf(',', start)
    if (commaIdx === -1) break
    parts.push(line.slice(start, commaIdx))
    start = commaIdx + 1
  }
  parts.push(line.slice(start))
  return parts
}

const DEFAULT_EVENT_FORMAT = ['Layer', 'Start', 'End', 'Style', 'Name', 'MarginL', 'MarginR', 'MarginV', 'Effect', 'Text']

function parseEvents(content: string): ASSDialogue[] {
  const dialogues: ASSDialogue[] = []
  let formatFields: string[] = []

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('Format:')) {
      const parsed = trimmed.slice(7).split(',').map(s => s.trim())
      if (parsed.includes('Start') && parsed.includes('Text')) {
        formatFields = parsed
      } else {
        formatFields = DEFAULT_EVENT_FORMAT
      }
      continue
    }
    if (trimmed.startsWith('Dialogue:') || trimmed.startsWith('Comment:')) {
      const isComment = trimmed.startsWith('Comment:')
      if (isComment) continue

      if (formatFields.length === 0) formatFields = DEFAULT_EVENT_FORMAT

      const rest = trimmed.slice(trimmed.indexOf(':') + 1).trim()
      const values = splitEventLine(rest, formatFields.length)
      if (values.length < formatFields.length) continue

      const map: Record<string, string> = {}
      formatFields.forEach((f, i) => { map[f] = values[i] })

      const text = map['Text'] ?? ''
      dialogues.push({
        layer: parseInt(map['Layer'], 10) || 0,
        start: parseASSTime(map['Start']?.trim() ?? '0:00:00.00'),
        end: parseASSTime(map['End']?.trim() ?? '0:00:00.00'),
        style: map['Style']?.trim() ?? 'Default',
        name: map['Name']?.trim() ?? '',
        marginL: parseInt(map['MarginL'], 10) || 0,
        marginR: parseInt(map['MarginR'], 10) || 0,
        marginV: parseInt(map['MarginV'], 10) || 0,
        effect: map['Effect']?.trim() ?? '',
        text,
        overrides: parseOverrides(text),
      })
    }
  }

  return dialogues
}

function splitEventLine(line: string, fieldCount: number): string[] {
  const parts: string[] = []
  let start = 0
  for (let i = 0; i < fieldCount - 1; i++) {
    const commaIdx = line.indexOf(',', start)
    if (commaIdx === -1) break
    parts.push(line.slice(start, commaIdx))
    start = commaIdx + 1
  }
  parts.push(line.slice(start))
  return parts
}

export function parseASSTime(time: string): number {
  const match = time.match(/(\d+):(\d{1,2}):(\d{1,2})[.,](\d{1,3})/)
  if (!match) return 0
  const h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  const s = parseInt(match[3], 10)
  const frac = match[4].padEnd(3, '0')
  return h * 3600 + m * 60 + s + parseInt(frac, 10) / 1000
}

export function parseASSColor(str: string): ASSColor {
  const clean = str.replace(/[&H]/gi, '').replace(/&$/, '')
  const num = parseInt(clean, 16)
  // ASS color format: &HAABBGGRR (alpha, blue, green, red)
  const a = (num >> 24) & 0xFF
  const b = (num >> 16) & 0xFF
  const g = (num >> 8) & 0xFF
  const r = num & 0xFF
  return { r, g, b, a }
}

export function parseOverrides(text: string): ASSOverrideBlock[] {
  const blocks: ASSOverrideBlock[] = []
  let pos = 0

  while (pos < text.length) {
    const braceStart = text.indexOf('{', pos)
    if (braceStart === -1) {
      const remaining = text.slice(pos)
      if (remaining) blocks.push({ tags: [], text: remaining })
      break
    }

    if (braceStart > pos) {
      blocks.push({ tags: [], text: text.slice(pos, braceStart) })
    }

    const braceEnd = text.indexOf('}', braceStart)
    if (braceEnd === -1) {
      blocks.push({ tags: [], text: text.slice(pos) })
      break
    }

    const tagStr = text.slice(braceStart + 1, braceEnd)
    const tags = parseTagString(tagStr)

    const nextBrace = text.indexOf('{', braceEnd + 1)
    const textEnd = nextBrace === -1 ? text.length : nextBrace
    const blockText = text.slice(braceEnd + 1, textEnd)

    blocks.push({ tags, text: blockText })
    pos = textEnd
  }

  return blocks
}

function parseTagString(str: string): ASSOverrideTag[] {
  const tags: ASSOverrideTag[] = []
  let pos = 0

  while (pos < str.length) {
    while (pos < str.length && str[pos] === ' ') pos++
    if (pos >= str.length) break
    if (str[pos] !== '\\') { pos++; continue }
    pos++

    const result = parseOneTag(str, pos)
    if (result) {
      tags.push(result.tag)
      pos = result.end
    } else {
      const next = str.indexOf('\\', pos)
      pos = next === -1 ? str.length : next
    }
  }

  return tags
}

interface ParseResult {
  tag: ASSOverrideTag
  end: number
}

function parseOneTag(str: string, pos: number): ParseResult | null {
  // \t(...) animation
  if (str.startsWith('t(', pos)) {
    return parseAnimationTag(str, pos + 2)
  }

  // \clip / \iclip
  if (str.startsWith('clip(', pos) || str.startsWith('iclip(', pos)) {
    const inverse = str[pos] === 'i'
    const start = str.indexOf('(', pos) + 1
    return parseClipTag(str, start, inverse)
  }

  // \move(x1,y1,x2,y2[,t1,t2])
  if (str.startsWith('move(', pos)) {
    return parseMoveTag(str, pos + 5)
  }

  // \pos(x,y)
  if (str.startsWith('pos(', pos)) {
    return parsePointTag(str, pos + 4, 'pos')
  }

  // \org(x,y)
  if (str.startsWith('org(', pos)) {
    return parsePointTag(str, pos + 4, 'org')
  }

  // \fad(t1,t2)
  if (str.startsWith('fad(', pos)) {
    return parseFadTag(str, pos + 4)
  }

  // \fade(a1,a2,a3,t1,t2,t3,t4)
  if (str.startsWith('fade(', pos)) {
    return parseFadeTag(str, pos + 5)
  }

  // Simple value tags
  const tagPatterns: Array<[string, ASSOverrideTag['type'], 'number' | 'string' | 'color' | 'alpha']> = [
    ['fscx', 'fscx', 'number'],
    ['fscy', 'fscy', 'number'],
    ['fsp', 'fsp', 'number'],
    ['frz', 'frz', 'number'],
    ['frx', 'frx', 'number'],
    ['fry', 'fry', 'number'],
    ['fn', 'fn', 'string'],
    ['fs', 'fs', 'number'],
    ['fe', 'fe', 'number'],
    ['bord', 'bord', 'number'],
    ['xbord', 'xbord', 'number'],
    ['ybord', 'ybord', 'number'],
    ['shad', 'shad', 'number'],
    ['xshad', 'xshad', 'number'],
    ['yshad', 'yshad', 'number'],
    ['blur', 'blur', 'number'],
    ['be', 'be', 'number'],
    ['kf', 'kf', 'number'],
    ['ko', 'ko', 'number'],
    ['1c', '1c', 'color'],
    ['2c', '2c', 'color'],
    ['3c', '3c', 'color'],
    ['4c', '4c', 'color'],
    ['1a', '1a', 'alpha'],
    ['2a', '2a', 'alpha'],
    ['3a', '3a', 'alpha'],
    ['4a', '4a', 'alpha'],
    ['alpha', 'alpha', 'alpha'],
    ['an', 'an', 'number'],
    ['pbo', 'pbo', 'number'],
    ['b', 'b', 'number'],
    ['i', 'i', 'number'],
    ['u', 'u', 'number'],
    ['s', 's', 'number'],
    ['c', 'c', 'color'],
    ['K', 'K', 'number'],
    ['k', 'k', 'number'],
    ['q', 'q', 'number'],
    ['p', 'p', 'number'],
    ['a', 'a', 'number'],
  ]

  // \r[style] — special: value is the rest until next \ or end
  if (str[pos] === 'r') {
    const valueEnd = findTagEnd(str, pos + 1)
    const value = str.slice(pos + 1, valueEnd)
    return { tag: { type: 'r', value } as ASSOverrideTag, end: valueEnd }
  }

  for (const [prefix, type, valueType] of tagPatterns) {
    if (!str.startsWith(prefix, pos)) continue
    const valueStart = pos + prefix.length
    const valueEnd = findTagEnd(str, valueStart)
    const rawValue = str.slice(valueStart, valueEnd).trim()

    let tag: ASSOverrideTag | null = null
    switch (valueType) {
      case 'number':
        tag = { type, value: parseFloat(rawValue) || 0 } as ASSOverrideTag
        break
      case 'string':
        tag = { type, value: rawValue } as ASSOverrideTag
        break
      case 'color':
        tag = { type, value: parseASSColor(rawValue) } as ASSOverrideTag
        break
      case 'alpha': {
        const clean = rawValue.replace(/[&H]/gi, '').replace(/&$/, '')
        tag = { type, value: parseInt(clean, 16) || 0 } as ASSOverrideTag
        break
      }
    }
    if (tag) return { tag, end: valueEnd }
  }

  return null
}

function findTagEnd(str: string, start: number): number {
  let i = start
  while (i < str.length && str[i] !== '\\' && str[i] !== '}') {
    i++
  }
  return i
}

function parseAnimationTag(str: string, pos: number): ParseResult | null {
  const closeIdx = findMatchingParen(str, pos - 1)
  if (closeIdx === -1) return null

  const inner = str.slice(pos, closeIdx)
  const animation: ASSAnimation = { tags: [] }

  const parts = splitAnimationArgs(inner)
  if (parts.length >= 3 && !parts[0].startsWith('\\')) {
    animation.t1 = parseFloat(parts[0])
    animation.t2 = parseFloat(parts[1])
    const rest = parts.slice(2)
    if (rest.length > 1 && !rest[0].startsWith('\\')) {
      animation.accel = parseFloat(rest[0])
      animation.tags = parseTagString(rest.slice(1).join(','))
    } else {
      animation.tags = parseTagString(rest.join(','))
    }
  } else if (parts.length >= 2 && !parts[0].startsWith('\\')) {
    animation.t1 = parseFloat(parts[0])
    animation.t2 = parseFloat(parts[1])
    animation.tags = parts.length > 2 ? parseTagString(parts.slice(2).join(',')) : []
  } else {
    animation.tags = parseTagString(inner)
  }

  if (!animation.tags) animation.tags = []

  return { tag: { type: 't', value: animation }, end: closeIdx + 1 }
}

function splitAnimationArgs(str: string): string[] {
  const result: string[] = []
  let depth = 0
  let start = 0

  for (let i = 0; i < str.length; i++) {
    if (str[i] === '(') depth++
    else if (str[i] === ')') depth--
    else if (str[i] === ',' && depth === 0) {
      result.push(str.slice(start, i).trim())
      start = i + 1
    }
  }
  result.push(str.slice(start).trim())
  return result
}

function parseClipTag(str: string, pos: number, inverse: boolean): ParseResult | null {
  const closeIdx = findMatchingParen(str, pos - 1)
  if (closeIdx === -1) return null

  const inner = str.slice(pos, closeIdx).trim()
  const parts = inner.split(',').map(s => s.trim())

  const type = inverse ? 'iclip' : 'clip'

  if (parts.length === 4 && !isNaN(Number(parts[0]))) {
    return {
      tag: {
        type,
        value: {
          inverse,
          rect: [parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])],
        },
      },
      end: closeIdx + 1,
    }
  }

  if (parts.length >= 1) {
    const scaleMatch = inner.match(/^(\d+),\s*(.+)$/)
    if (scaleMatch) {
      return {
        tag: {
          type,
          value: { inverse, drawing: scaleMatch[2], scale: parseInt(scaleMatch[1], 10) },
        },
        end: closeIdx + 1,
      }
    }
    return {
      tag: { type, value: { inverse, drawing: inner } },
      end: closeIdx + 1,
    }
  }

  return null
}

function parseMoveTag(str: string, pos: number): ParseResult | null {
  const closeIdx = findMatchingParen(str, pos - 1)
  if (closeIdx === -1) return null

  const inner = str.slice(pos, closeIdx)
  const parts = inner.split(',').map(s => parseFloat(s.trim()))

  if (parts.length >= 4) {
    return {
      tag: { type: 'move', value: parts.slice(0, 6) as [number, number, number, number, number?, number?] },
      end: closeIdx + 1,
    }
  }
  return null
}

function parsePointTag(str: string, pos: number, type: 'pos' | 'org'): ParseResult | null {
  const closeIdx = findMatchingParen(str, pos - 1)
  if (closeIdx === -1) return null

  const inner = str.slice(pos, closeIdx)
  const parts = inner.split(',').map(s => parseFloat(s.trim()))

  if (parts.length >= 2) {
    return {
      tag: { type, value: [parts[0], parts[1]] as [number, number] },
      end: closeIdx + 1,
    }
  }
  return null
}

function parseFadTag(str: string, pos: number): ParseResult | null {
  const closeIdx = findMatchingParen(str, pos - 1)
  if (closeIdx === -1) return null

  const inner = str.slice(pos, closeIdx)
  const parts = inner.split(',').map(s => parseInt(s.trim(), 10))

  if (parts.length >= 2) {
    return {
      tag: { type: 'fad', value: [parts[0], parts[1]] as [number, number] },
      end: closeIdx + 1,
    }
  }
  return null
}

function parseFadeTag(str: string, pos: number): ParseResult | null {
  const closeIdx = findMatchingParen(str, pos - 1)
  if (closeIdx === -1) return null

  const inner = str.slice(pos, closeIdx)
  const parts = inner.split(',').map(s => parseInt(s.trim(), 10))

  if (parts.length >= 7) {
    return {
      tag: {
        type: 'fade',
        value: parts.slice(0, 7) as [number, number, number, number, number, number, number],
      },
      end: closeIdx + 1,
    }
  }
  return null
}

function findMatchingParen(str: string, openIdx: number): number {
  let depth = 1
  for (let i = openIdx + 1; i < str.length; i++) {
    if (str[i] === '(') depth++
    else if (str[i] === ')') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}
