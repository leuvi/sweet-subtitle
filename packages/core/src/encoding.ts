export interface DecodeBufferOptions {
  forceEncoding?: string
  fallbackEncodings?: string[]
}

const DEFAULT_FALLBACK_ENCODINGS = ['gbk', 'big5', 'shift_jis']

export function detectEncoding(buffer: ArrayBuffer, options?: DecodeBufferOptions): string {
  if (options?.forceEncoding) return normalizeEncoding(options.forceEncoding)

  const bytes = new Uint8Array(buffer)
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) return 'utf-16le'
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) return 'utf-16be'
  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) return 'utf-8'

  const utf16Heuristic = detectUTF16WithoutBOM(bytes)
  if (utf16Heuristic) return utf16Heuristic

  if (isUTF8(bytes)) return 'utf-8'
  return 'gbk'
}

function isUTF8(bytes: Uint8Array): boolean {
  let i = 0
  let nonAsciiValid = 0
  let nonAsciiInvalid = 0
  const len = Math.min(bytes.length, 4096)
  while (i < len) {
    const b = bytes[i]
    if (b <= 0x7F) {
      i++
      continue
    }
    let seqLen: number
    if ((b & 0xE0) === 0xC0) seqLen = 2
    else if ((b & 0xF0) === 0xE0) seqLen = 3
    else if ((b & 0xF8) === 0xF0) seqLen = 4
    else {
      nonAsciiInvalid++
      i++
      continue
    }
    if (i + seqLen > len) break
    let valid = true
    for (let j = 1; j < seqLen; j++) {
      if ((bytes[i + j] & 0xC0) !== 0x80) {
        valid = false
        break
      }
    }
    if (valid) nonAsciiValid++
    else nonAsciiInvalid++
    i += valid ? seqLen : 1
  }
  if (nonAsciiValid === 0 && nonAsciiInvalid === 0) return true
  return nonAsciiValid > nonAsciiInvalid
}

function detectUTF16WithoutBOM(bytes: Uint8Array): 'utf-16le' | 'utf-16be' | null {
  const len = Math.min(bytes.length - (bytes.length % 2), 4096)
  if (len < 8) return null

  let zeroEven = 0
  let zeroOdd = 0

  for (let i = 0; i < len; i += 2) {
    if (bytes[i] === 0) zeroEven++
    if (bytes[i + 1] === 0) zeroOdd++
  }

  const pairs = len / 2
  const evenRatio = zeroEven / pairs
  const oddRatio = zeroOdd / pairs
  const threshold = 0.35
  const gap = 0.2

  if (oddRatio > threshold && oddRatio - evenRatio > gap) return 'utf-16le'
  if (evenRatio > threshold && evenRatio - oddRatio > gap) return 'utf-16be'
  return null
}

function normalizeEncoding(encoding: string): string {
  return encoding.trim().toLowerCase().replace(/_/g, '-')
}

function uniqEncodings(encodings: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const enc of encodings) {
    const normalized = normalizeEncoding(enc)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
  }
  return out
}

export function decodeBuffer(buffer: ArrayBuffer, options?: DecodeBufferOptions): string {
  const detected = detectEncoding(buffer, options)
  const fallbackEncodings = options?.fallbackEncodings?.length
    ? options.fallbackEncodings
    : DEFAULT_FALLBACK_ENCODINGS

  const candidates = uniqEncodings([detected, ...fallbackEncodings])
  let lastError: Error | null = null

  for (const encoding of candidates) {
    try {
      const decoder = new TextDecoder(encoding, { fatal: true })
      return decoder.decode(buffer)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }

  try {
    const decoder = new TextDecoder(detected)
    return decoder.decode(buffer)
  } catch (err) {
    const fallbackError = err instanceof Error ? err : new Error(String(err))
    throw new Error(
      `Failed to decode subtitle buffer. Tried encodings: ${candidates.join(', ')}. Last error: ${lastError?.message ?? fallbackError.message}`
    )
  }
}
