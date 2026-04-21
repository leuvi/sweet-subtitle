export function detectEncoding(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) return 'utf-16le'
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) return 'utf-16be'
  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) return 'utf-8'
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

export function decodeBuffer(buffer: ArrayBuffer): string {
  const encoding = detectEncoding(buffer)
  const decoder = new TextDecoder(encoding)
  return decoder.decode(buffer)
}
