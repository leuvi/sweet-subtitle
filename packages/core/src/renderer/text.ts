import type { SubtitleCue } from '../types'
import { BaseRenderer } from './base'

export class TextRenderer extends BaseRenderer {
  private fontSize = 0
  private lineHeight = 0
  private padding = 0

  protected draw(cues: SubtitleCue[]): void {
    const ctx = this.ctx
    const w = this.canvas.width / (window.devicePixelRatio || 1)
    const h = this.canvas.height / (window.devicePixelRatio || 1)

    this.fontSize = Math.max(16, Math.round(h * 0.045))
    this.lineHeight = this.fontSize * 1.4
    this.padding = this.fontSize * 0.4

    ctx.font = `${this.fontSize}px "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'

    let y = h - this.fontSize * 0.8

    for (let i = cues.length - 1; i >= 0; i--) {
      const cue = cues[i]
      const lines = this.wrapText(cue.text, w * 0.9)

      for (let j = lines.length - 1; j >= 0; j--) {
        const line = lines[j]
        const textWidth = ctx.measureText(line).width

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
        const rx = w / 2 - textWidth / 2 - this.padding
        const ry = y - this.fontSize - this.padding * 0.5
        const rw = textWidth + this.padding * 2
        const rh = this.fontSize + this.padding
        roundRect(ctx, rx, ry, rw, rh, 4)

        ctx.fillStyle = '#ffffff'
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 3
        ctx.lineJoin = 'round'
        ctx.strokeText(line, w / 2, y)
        ctx.fillText(line, w / 2, y)

        y -= this.lineHeight
      }

      y -= this.fontSize * 0.3
    }
  }

  private wrapText(text: string, maxWidth: number): string[] {
    const rawLines = text.replace(/\\N/g, '\n').replace(/\\n/g, '\n').split('\n')
    const result: string[] = []

    for (const rawLine of rawLines) {
      const stripped = rawLine.replace(/<[^>]*>/g, '')
      if (this.ctx.measureText(stripped).width <= maxWidth) {
        result.push(stripped)
        continue
      }

      let current = ''
      for (const char of stripped) {
        const test = current + char
        if (this.ctx.measureText(test).width > maxWidth && current) {
          result.push(current)
          current = char
        } else {
          current = test
        }
      }
      if (current) result.push(current)
    }

    return result
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
  ctx.fill()
}
