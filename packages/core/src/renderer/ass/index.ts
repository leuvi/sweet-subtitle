import type {
  ASSColor, ASSDialogue, ASSOverrideBlock, ASSOverrideTag,
  ASSStyle, ASSTrack, ASSClip, ASSAnimation, SubtitleCue,
} from '../../types'
import { BaseRenderer } from '../base'
import { parseASSColor } from '../../parser/ass'
import { loadWasm, getWasm } from '../../wasm/bridge'

interface ComputedStyle {
  fontname: string
  fontsize: number
  primaryColor: ASSColor
  secondaryColor: ASSColor
  outlineColor: ASSColor
  backColor: ASSColor
  bold: boolean
  italic: boolean
  underline: boolean
  strikeOut: boolean
  scaleX: number
  scaleY: number
  spacing: number
  angle: number
  angleX: number
  angleY: number
  borderStyle: number
  outline: number
  shadow: number
  alignment: number
  marginL: number
  marginR: number
  marginV: number
  alpha: number
  primaryAlpha: number
  secondaryAlpha: number
  outlineAlpha: number
  backAlpha: number
  blur: number
  be: number
  drawingMode: number
  karaokeType: '' | 'k' | 'kf' | 'ko' | 'K'
  karaokeDuration: number
}

interface TextSegment {
  text: string
  style: ComputedStyle
  width: number
  karaokeStart: number
  karaokeDuration: number
  isDrawing: boolean
}

interface DialogueLayout {
  dialogue: ASSDialogue
  style: ASSStyle
  x: number
  y: number
  positioned: boolean
  moveTarget?: { x2: number; y2: number; t1: number; t2: number }
  clip?: ASSClip | null
  fadeAlpha: number
  org?: [number, number] | null
}

export class ASSRenderer extends BaseRenderer {
  private assTrack: ASSTrack | null = null
  private styleMap = new Map<string, ASSStyle>()
  private scaleX = 1
  private scaleY = 1

  setTrack(track: ASSTrack): void {
    super.setTrack(track)
    this.assTrack = track
    this.styleMap.clear()
    for (const style of track.styles) {
      this.styleMap.set(style.name, style)
    }
    loadWasm()
  }

  syncSize(): void {
    super.syncSize()
    this.updateScale()
  }

  private updateScale(): void {
    if (!this.assTrack) return
    const w = this.canvas.width / (window.devicePixelRatio || 1)
    const h = this.canvas.height / (window.devicePixelRatio || 1)
    this.scaleX = w / this.assTrack.scriptInfo.playResX
    this.scaleY = h / this.assTrack.scriptInfo.playResY
  }

  protected draw(_cues: SubtitleCue[], time: number): void {
    if (!this.assTrack) return
    this.updateScale()

    const w = this.canvas.width / (window.devicePixelRatio || 1)
    const h = this.canvas.height / (window.devicePixelRatio || 1)

    const activeDialogues = this.assTrack.dialogues
      .filter(d => time >= d.start && time <= d.end)
      .sort((a, b) => a.layer - b.layer)

    const layouts = this.layoutDialogues(activeDialogues, w, h, time)

    for (const layout of layouts) {
      this.renderDialogue(layout, time, w, h)
    }
  }

  private layoutDialogues(
    dialogues: ASSDialogue[], w: number, h: number, time: number,
  ): DialogueLayout[] {
    const result: DialogueLayout[] = []
    const occupiedBottom: number[] = []
    const occupiedTop: number[] = []
    const occupiedMiddle: number[] = []

    for (const dialogue of dialogues) {
      const style = this.resolveStyle(dialogue.style)
      const fontSize = style.fontsize * this.scaleY
      const lineHeight = fontSize * 1.3
      const lines = this.getDialogueLines(dialogue)
      const totalHeight = lines.length * lineHeight

      const alignment = this.getAlignment(dialogue, style)
      const pos = this.getStaticPos(dialogue)
      const move = this.getMove(dialogue)
      const fad = this.getFad(dialogue)
      const fade = this.getFade(dialogue)
      const clip = this.getClip(dialogue)
      const org = this.getOrg(dialogue)

      let fadeAlpha = 1
      if (fad) {
        const elapsed = (time - dialogue.start) * 1000
        const remaining = (dialogue.end - time) * 1000
        if (fad[0] > 0 && elapsed < fad[0]) fadeAlpha = elapsed / fad[0]
        if (fad[1] > 0 && remaining < fad[1]) fadeAlpha = Math.min(fadeAlpha, remaining / fad[1])
      }
      if (fade) {
        const t = (time - dialogue.start) * 1000
        const [a1, a2, a3, t1, t2, t3, t4] = fade
        let a: number
        if (t <= t1) a = a1
        else if (t < t2) a = a1 + (a2 - a1) * (t - t1) / (t2 - t1)
        else if (t <= t3) a = a2
        else if (t < t4) a = a2 + (a3 - a2) * (t - t3) / (t4 - t3)
        else a = a3
        fadeAlpha *= 1 - a / 255
      }

      if (pos) {
        const x = pos[0] * this.scaleX
        const y = pos[1] * this.scaleY
        result.push({ dialogue, style, x, y, positioned: true, clip, fadeAlpha, org })
        continue
      }

      if (move) {
        const x = move[0] * this.scaleX
        const y = move[1] * this.scaleY
        const duration = (dialogue.end - dialogue.start) * 1000
        const t1 = move[4] ?? 0
        const t2 = move[5] ?? duration
        result.push({
          dialogue, style, x, y, positioned: true,
          moveTarget: { x2: move[2] * this.scaleX, y2: move[3] * this.scaleY, t1, t2 },
          clip, fadeAlpha, org,
        })
        continue
      }

      const marginL = (dialogue.marginL || style.marginL) * this.scaleX
      const marginR = (dialogue.marginR || style.marginR) * this.scaleX
      const marginV = (dialogue.marginV || style.marginV) * this.scaleY
      const col = alignment % 3
      let x: number
      if (col === 1) x = marginL
      else if (col === 0) x = w - marginR
      else x = w / 2

      const row = Math.ceil(alignment / 3)
      let y: number
      if (row === 1) {
        y = h - marginV
        for (const oh of occupiedBottom) {
          if (Math.abs(y - oh) < totalHeight) y -= totalHeight
        }
        occupiedBottom.push(y)
      } else if (row === 3) {
        y = marginV + totalHeight
        for (const oh of occupiedTop) {
          if (Math.abs(y - oh) < totalHeight) y += totalHeight
        }
        occupiedTop.push(y)
      } else {
        y = h / 2 + totalHeight / 2
        for (const oh of occupiedMiddle) {
          if (Math.abs(y - oh) < totalHeight) y += totalHeight
        }
        occupiedMiddle.push(y)
      }

      result.push({ dialogue, style, x, y, positioned: false, clip, fadeAlpha, org })
    }

    return result
  }

  private renderDialogue(layout: DialogueLayout, time: number, w: number, h: number): void {
    const { dialogue, style } = layout
    const ctx = this.ctx
    const baseComputed = this.computeBaseStyle(style)
    const fontSize = style.fontsize * this.scaleY
    const lineHeight = fontSize * 1.3
    const lines = this.getDialogueLines(dialogue)
    const alignment = this.getAlignment(dialogue, style)

    let x = layout.x
    let y = layout.y

    if (layout.moveTarget) {
      const elapsed = (time - dialogue.start) * 1000
      const { x2, y2, t1, t2 } = layout.moveTarget
      const progress = Math.max(0, Math.min(1, (elapsed - t1) / (t2 - t1)))
      x = layout.x + (x2 - layout.x) * progress
      y = layout.y + (y2 - layout.y) * progress
    }

    ctx.save()
    ctx.globalAlpha = Math.max(0, Math.min(1, layout.fadeAlpha))

    if (layout.clip) {
      this.applyClip(ctx, layout.clip)
    }

    const globalAngle = this.getGlobalAngle(dialogue, style)
    const orgPoint = layout.org
      ? [layout.org[0] * this.scaleX, layout.org[1] * this.scaleY] as [number, number]
      : null

    if (globalAngle !== 0 && layout.positioned) {
      const ox = orgPoint ? orgPoint[0] : x
      const oy = orgPoint ? orgPoint[1] : y
      ctx.translate(ox, oy)
      ctx.rotate(globalAngle * Math.PI / 180)
      ctx.translate(-ox, -oy)
    }

    const karaokeStartTime = this.collectKaraokeTimings(dialogue)

    const marginL = (dialogue.marginL || style.marginL) * this.scaleX
    const marginR = (dialogue.marginR || style.marginR) * this.scaleX
    const maxWidth = layout.positioned ? 0 : w - marginL - marginR

    for (let li = lines.length - 1; li >= 0; li--) {
      const blocks = lines[li]
      const extraLines = this.renderLine(ctx, blocks, baseComputed, x, y, alignment, fontSize, time, dialogue, karaokeStartTime, maxWidth, layout.positioned)
      y -= lineHeight * (1 + extraLines)
    }

    ctx.restore()
  }

  private renderLine(
    ctx: CanvasRenderingContext2D,
    blocks: ASSOverrideBlock[],
    baseStyle: ComputedStyle,
    x: number, y: number,
    alignment: number,
    fontSize: number,
    time: number,
    dialogue: ASSDialogue,
    karaokeBase: number,
    maxWidth: number,
    positioned: boolean,
  ): number {
    const current = { ...baseStyle }
    const segments: TextSegment[] = []
    let karaokeAccum = karaokeBase

    for (const block of blocks) {
      this.applyTags(block.tags, current, baseStyle, time, dialogue)

      for (const tag of block.tags) {
        if (tag.type === 'k' || tag.type === 'kf' || tag.type === 'ko' || tag.type === 'K') {
          current.karaokeType = tag.type
          current.karaokeDuration = tag.value * 10
        }
      }

      if (block.text) {
        const isDrawing = current.drawingMode > 0
        ctx.font = this.buildFont(current, fontSize)
        const rawWidth = isDrawing ? 0 : ctx.measureText(block.text).width
        const width = rawWidth * (current.scaleX / 100)

        segments.push({
          text: block.text,
          style: { ...current },
          width,
          karaokeStart: karaokeAccum,
          karaokeDuration: current.karaokeDuration,
          isDrawing,
        })

        if (current.karaokeType) {
          karaokeAccum += current.karaokeDuration
        }
      }
    }

    let totalWidth = 0
    for (const seg of segments) totalWidth += seg.width

    if (!positioned && maxWidth > 0 && totalWidth > maxWidth) {
      return this.renderWrappedLine(ctx, segments, x, y, alignment, fontSize, time, dialogue, maxWidth)
    }

    const col = alignment % 3
    let drawX: number
    if (col === 0) drawX = x - totalWidth
    else if (col === 1) drawX = x
    else drawX = x - totalWidth / 2

    for (const seg of segments) {
      if (seg.isDrawing) {
        this.renderDrawing(ctx, seg.text, seg.style, drawX, y, fontSize)
        continue
      }
      this.renderSegment(ctx, seg, drawX, y, fontSize, time, dialogue)
      drawX += seg.width
    }
    return 0
  }

  private renderWrappedLine(
    ctx: CanvasRenderingContext2D,
    segments: TextSegment[],
    x: number, y: number,
    alignment: number,
    fontSize: number,
    time: number,
    dialogue: ASSDialogue,
    maxWidth: number,
  ): number {
    const subLines: TextSegment[][] = []
    let currentLine: TextSegment[] = []
    let lineWidth = 0

    for (const seg of segments) {
      if (seg.isDrawing) {
        currentLine.push(seg)
        continue
      }

      ctx.font = this.buildFont(seg.style, fontSize)

      if (lineWidth + seg.width <= maxWidth) {
        currentLine.push(seg)
        lineWidth += seg.width
        continue
      }

      let remaining = seg.text
      while (remaining.length > 0) {
        const availWidth = maxWidth - lineWidth
        let fit = ''
        let fitWidth = 0

        for (const char of remaining) {
          const charW = ctx.measureText(char).width
          if (fitWidth + charW > availWidth && (fit.length > 0 || currentLine.length > 0)) break
          fit += char
          fitWidth += charW
        }

        if (fit.length > 0) {
          currentLine.push({
            ...seg,
            text: fit,
            width: fitWidth,
          })
          lineWidth += fitWidth
        }

        remaining = remaining.slice(fit.length)
        if (remaining.length > 0) {
          subLines.push(currentLine)
          currentLine = []
          lineWidth = 0
        }
      }
    }
    if (currentLine.length > 0) subLines.push(currentLine)

    const lineHeight = fontSize * 1.3
    const extraLines = subLines.length - 1
    let drawY = y - extraLines * lineHeight

    for (const line of subLines) {
      let tw = 0
      for (const seg of line) tw += seg.width

      const col = alignment % 3
      let drawX: number
      if (col === 0) drawX = x - tw
      else if (col === 1) drawX = x
      else drawX = x - tw / 2

      for (const seg of line) {
        if (seg.isDrawing) {
          this.renderDrawing(ctx, seg.text, seg.style, drawX, drawY, fontSize)
          continue
        }
        this.renderSegment(ctx, seg, drawX, drawY, fontSize, time, dialogue)
        drawX += seg.width
      }
      drawY += lineHeight
    }

    return extraLines
  }

  private renderSegment(
    ctx: CanvasRenderingContext2D,
    seg: TextSegment,
    x: number, y: number,
    fontSize: number,
    time: number,
    dialogue: ASSDialogue,
  ): void {
    const s = seg.style
    ctx.font = this.buildFont(s, fontSize)
    ctx.textBaseline = 'bottom'

    const alpha = Math.max(0, Math.min(1, 1 - s.primaryAlpha / 255))

    if (seg.style.karaokeType && seg.karaokeDuration > 0) {
      this.renderKaraokeSegment(ctx, seg, x, y, fontSize, time, dialogue, alpha)
      return
    }

    const needsTransform = s.angle !== 0 || s.angleX !== 0 || s.angleY !== 0 || s.scaleX !== 100
    if (needsTransform) {
      ctx.save()
      const cx = x + seg.width / 2
      const cy = y - fontSize / 2
      ctx.translate(cx, cy)

      if (s.angleX !== 0 || s.angleY !== 0) {
        const radX = s.angleX * Math.PI / 180
        const radY = s.angleY * Math.PI / 180
        const cosX = Math.cos(radX)
        const cosY = Math.cos(radY)
        ctx.transform(cosY, Math.sin(radX) * 0.5, -Math.sin(radY) * 0.5, cosX, 0, 0)
      }

      if (s.angle !== 0) ctx.rotate(s.angle * Math.PI / 180)
      if (s.scaleX !== 100) ctx.scale(s.scaleX / 100, 1)

      ctx.translate(-cx, -cy)
    }

    this.drawTextWithEffects(ctx, seg.text, x, y, s, fontSize, alpha, seg.width)

    if (needsTransform) {
      ctx.restore()
    }
  }

  private drawTextWithEffects(
    ctx: CanvasRenderingContext2D,
    text: string, x: number, y: number,
    s: ComputedStyle, fontSize: number, alpha: number,
    segWidth?: number,
  ): void {
    const blurRadius = s.blur > 0 ? s.blur * this.scaleX : s.be > 0 ? s.be * this.scaleX : 0

    if (blurRadius > 0) {
      this.drawTextBlurred(ctx, text, x, y, s, fontSize, alpha, blurRadius, segWidth)
      return
    }

    this.drawTextDirect(ctx, text, x, y, s, fontSize, alpha, segWidth)
  }

  private drawTextDirect(
    ctx: CanvasRenderingContext2D,
    text: string, x: number, y: number,
    s: ComputedStyle, fontSize: number, alpha: number,
    segWidth?: number,
  ): void {
    const spacing = s.spacing * this.scaleX

    if (s.shadow > 0) {
      const sa = Math.max(0, Math.min(1, 1 - s.backAlpha / 255))
      ctx.globalAlpha = (ctx.globalAlpha > 0 ? ctx.globalAlpha : 1) * sa
      ctx.fillStyle = assColorToCSS(s.backColor, s.backAlpha)
      if (spacing !== 0) {
        this.fillTextSpaced(ctx, text, x + s.shadow * this.scaleX, y + s.shadow * this.scaleY, spacing)
      } else {
        ctx.fillText(text, x + s.shadow * this.scaleX, y + s.shadow * this.scaleY)
      }
      ctx.globalAlpha = ctx.globalAlpha / (sa || 1)
    }

    if (s.outline > 0) {
      const oa = Math.max(0, Math.min(1, 1 - s.outlineAlpha / 255))
      ctx.strokeStyle = assColorToCSS(s.outlineColor, s.outlineAlpha)
      ctx.lineWidth = s.outline * 2 * this.scaleX
      ctx.lineJoin = 'round'
      ctx.globalAlpha = (ctx.globalAlpha > 0 ? ctx.globalAlpha : 1) * oa
      if (spacing !== 0) {
        this.strokeTextSpaced(ctx, text, x, y, spacing)
      } else {
        ctx.strokeText(text, x, y)
      }
      ctx.globalAlpha = ctx.globalAlpha / (oa || 1)
    }

    if (s.borderStyle === 3 && s.outline > 0) {
      ctx.fillStyle = assColorToCSS(s.outlineColor, s.outlineAlpha)
      const metrics = ctx.measureText(text)
      const pad = s.outline * this.scaleX
      ctx.fillRect(x - pad, y - fontSize - pad, metrics.width + pad * 2, fontSize + pad * 2)
    }

    ctx.fillStyle = assColorToCSS(s.primaryColor, s.primaryAlpha)
    ctx.globalAlpha = (ctx.globalAlpha > 0 ? ctx.globalAlpha : 1) * alpha
    if (spacing !== 0) {
      this.fillTextSpaced(ctx, text, x, y, spacing)
    } else {
      ctx.fillText(text, x, y)
    }

    const textW = segWidth ?? ctx.measureText(text).width
    this.drawTextDecorations(ctx, x, y, textW, s, fontSize)
  }

  private drawTextBlurred(
    ctx: CanvasRenderingContext2D,
    text: string, x: number, y: number,
    s: ComputedStyle, fontSize: number, alpha: number,
    blurRadius: number,
    segWidth?: number,
  ): void {
    const padding = Math.ceil(blurRadius * 3)
    const textW = segWidth ?? ctx.measureText(text).width
    const extraOutline = s.outline > 0 ? s.outline * 2 * this.scaleX : 0
    const extraShadow = s.shadow > 0 ? Math.abs(s.shadow) * this.scaleX : 0
    const bw = Math.ceil(textW + extraOutline + extraShadow + padding * 2)
    const bh = Math.ceil(fontSize * 1.5 + extraOutline + extraShadow + padding * 2)

    if (bw <= 0 || bh <= 0) return

    const dpr = window.devicePixelRatio || 1
    const offscreen = new OffscreenCanvas(bw * dpr, bh * dpr)
    const offCtx = offscreen.getContext('2d')!
    offCtx.setTransform(dpr, 0, 0, dpr, 0, 0)

    offCtx.font = ctx.font
    offCtx.textBaseline = 'bottom'

    const ox = padding + extraOutline / 2
    const oy = padding + fontSize + extraOutline / 2

    const savedAlpha = ctx.globalAlpha
    offCtx.globalAlpha = savedAlpha
    this.drawTextDirect(offCtx as unknown as CanvasRenderingContext2D, text, ox, oy, s, fontSize, alpha, segWidth)

    const imgData = offCtx.getImageData(0, 0, bw * dpr, bh * dpr)
    const wasm = getWasm()
    if (wasm) {
      const data = new Uint8Array(imgData.data.buffer)
      wasm.gaussian_blur(data, imgData.width, imgData.height, blurRadius * dpr)
      offCtx.putImageData(imgData, 0, 0)
    } else {
      offCtx.clearRect(0, 0, bw * dpr, bh * dpr)
      offCtx.filter = `blur(${blurRadius}px)`
      offCtx.putImageData(imgData, 0, 0)
      offCtx.drawImage(offscreen, 0, 0)
      offCtx.filter = 'none'
    }

    ctx.globalAlpha = savedAlpha
    ctx.drawImage(offscreen, x - ox, y - oy, bw, bh)
  }

  private drawTextDecorations(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    textWidth: number,
    s: ComputedStyle, fontSize: number,
  ): void {
    if (!s.underline && !s.strikeOut) return

    ctx.strokeStyle = assColorToCSS(s.primaryColor, s.primaryAlpha)
    ctx.lineWidth = Math.max(1, fontSize * 0.05)
    ctx.lineJoin = 'round'

    if (s.underline) {
      const uy = y + fontSize * 0.08
      ctx.beginPath()
      ctx.moveTo(x, uy)
      ctx.lineTo(x + textWidth, uy)
      ctx.stroke()
    }

    if (s.strikeOut) {
      const sy = y - fontSize * 0.35
      ctx.beginPath()
      ctx.moveTo(x, sy)
      ctx.lineTo(x + textWidth, sy)
      ctx.stroke()
    }
  }

  private renderKaraokeSegment(
    ctx: CanvasRenderingContext2D,
    seg: TextSegment,
    x: number, y: number,
    fontSize: number,
    time: number,
    dialogue: ASSDialogue,
    alpha: number,
  ): void {
    const s = seg.style
    const elapsed = (time - dialogue.start) * 1000
    const karaokeElapsed = elapsed - seg.karaokeStart

    ctx.font = this.buildFont(s, fontSize)
    ctx.textBaseline = 'bottom'

    if (s.outline > 0) {
      ctx.strokeStyle = assColorToCSS(s.outlineColor, s.outlineAlpha)
      ctx.lineWidth = s.outline * 2 * this.scaleX
      ctx.lineJoin = 'round'
      ctx.strokeText(seg.text, x, y)
    }

    if (seg.style.karaokeType === 'kf' || seg.style.karaokeType === 'K') {
      const progress = Math.max(0, Math.min(1, karaokeElapsed / seg.karaokeDuration))
      const splitX = x + seg.width * progress

      ctx.save()
      ctx.beginPath()
      ctx.rect(x, y - fontSize * 1.5, splitX - x, fontSize * 2)
      ctx.clip()
      ctx.fillStyle = assColorToCSS(s.primaryColor, s.primaryAlpha)
      ctx.globalAlpha = alpha
      ctx.fillText(seg.text, x, y)
      ctx.restore()

      ctx.save()
      ctx.beginPath()
      ctx.rect(splitX, y - fontSize * 1.5, x + seg.width - splitX, fontSize * 2)
      ctx.clip()
      ctx.fillStyle = assColorToCSS(s.secondaryColor, s.secondaryAlpha)
      ctx.globalAlpha = alpha
      ctx.fillText(seg.text, x, y)
      ctx.restore()
    } else {
      const highlighted = karaokeElapsed >= 0
      if (highlighted) {
        ctx.fillStyle = assColorToCSS(s.primaryColor, s.primaryAlpha)
      } else {
        ctx.fillStyle = assColorToCSS(s.secondaryColor, s.secondaryAlpha)
      }
      ctx.globalAlpha = alpha
      ctx.fillText(seg.text, x, y)
    }
  }

  private renderDrawing(
    ctx: CanvasRenderingContext2D,
    commands: string,
    style: ComputedStyle,
    x: number, y: number,
    _fontSize: number,
  ): void {
    const scale = style.drawingMode
    if (scale <= 0) return

    const path = this.parseDrawingCommands(commands, scale)
    if (!path) return

    ctx.save()
    ctx.translate(x, y)
    ctx.scale(this.scaleX, this.scaleY)

    if (style.shadow > 0) {
      ctx.save()
      ctx.translate(style.shadow, style.shadow)
      ctx.fillStyle = assColorToCSS(style.backColor, style.backAlpha)
      ctx.fill(path)
      ctx.restore()
    }

    if (style.outline > 0) {
      ctx.strokeStyle = assColorToCSS(style.outlineColor, style.outlineAlpha)
      ctx.lineWidth = style.outline * 2
      ctx.lineJoin = 'round'
      ctx.stroke(path)
    }

    ctx.fillStyle = assColorToCSS(style.primaryColor, style.primaryAlpha)
    ctx.fill(path)

    ctx.restore()
  }

  private parseDrawingCommands(commands: string, scale: number): Path2D | null {
    const path = new Path2D()
    const s = 1 / (1 << (scale - 1))
    const tokens = commands.trim().split(/\s+/)
    let i = 0
    let cx = 0, cy = 0

    while (i < tokens.length) {
      const cmd = tokens[i]
      i++

      switch (cmd) {
        case 'm':
          if (i + 1 < tokens.length) {
            cx = parseFloat(tokens[i]) * s; cy = parseFloat(tokens[i + 1]) * s
            path.moveTo(cx, cy)
            i += 2
          }
          break
        case 'n':
          if (i + 1 < tokens.length) {
            cx = parseFloat(tokens[i]) * s; cy = parseFloat(tokens[i + 1]) * s
            path.moveTo(cx, cy)
            i += 2
          }
          break
        case 'l':
          while (i + 1 < tokens.length && !isNaN(Number(tokens[i]))) {
            cx = parseFloat(tokens[i]) * s; cy = parseFloat(tokens[i + 1]) * s
            path.lineTo(cx, cy)
            i += 2
          }
          break
        case 'b':
          while (i + 5 < tokens.length && !isNaN(Number(tokens[i]))) {
            const x1 = parseFloat(tokens[i]) * s, y1 = parseFloat(tokens[i + 1]) * s
            const x2 = parseFloat(tokens[i + 2]) * s, y2 = parseFloat(tokens[i + 3]) * s
            const x3 = parseFloat(tokens[i + 4]) * s, y3 = parseFloat(tokens[i + 5]) * s
            path.bezierCurveTo(x1, y1, x2, y2, x3, y3)
            cx = x3; cy = y3
            i += 6
          }
          break
        case 's':
          while (i + 3 < tokens.length && !isNaN(Number(tokens[i]))) {
            const x1 = parseFloat(tokens[i]) * s, y1 = parseFloat(tokens[i + 1]) * s
            const x2 = parseFloat(tokens[i + 2]) * s, y2 = parseFloat(tokens[i + 3]) * s
            const cp1x = 2 * cx - cx, cp1y = 2 * cy - cy
            path.bezierCurveTo(cp1x, cp1y, x1, y1, x2, y2)
            cx = x2; cy = y2
            i += 4
          }
          break
        case 'p':
          while (i + 1 < tokens.length && !isNaN(Number(tokens[i]))) {
            cx = parseFloat(tokens[i]) * s; cy = parseFloat(tokens[i + 1]) * s
            path.lineTo(cx, cy)
            i += 2
          }
          break
        case 'c':
          path.closePath()
          break
        default:
          if (!isNaN(Number(cmd)) && i < tokens.length) {
            cx = parseFloat(cmd) * s; cy = parseFloat(tokens[i]) * s
            path.lineTo(cx, cy)
            i++
          }
          break
      }
    }

    path.closePath()
    return path
  }

  private applyClip(ctx: CanvasRenderingContext2D, clip: ASSClip): void {
    if (clip.rect) {
      const [x1, y1, x2, y2] = clip.rect
      ctx.beginPath()
      ctx.rect(
        x1 * this.scaleX, y1 * this.scaleY,
        (x2 - x1) * this.scaleX, (y2 - y1) * this.scaleY,
      )
      ctx.clip()
    } else if (clip.drawing) {
      const scale = clip.scale ?? 1
      const path = this.parseDrawingCommands(clip.drawing, scale)
      if (path) {
        ctx.save()
        ctx.scale(this.scaleX, this.scaleY)
        ctx.clip(path)
        ctx.restore()
      }
    }
  }

  private applyTags(
    tags: ASSOverrideTag[], current: ComputedStyle,
    base: ComputedStyle, time: number, dialogue: ASSDialogue,
  ): void {
    for (const tag of tags) {
      switch (tag.type) {
        case 'b': current.bold = tag.value !== 0; break
        case 'i': current.italic = tag.value !== 0; break
        case 'u': current.underline = tag.value !== 0; break
        case 's': current.strikeOut = tag.value !== 0; break
        case 'fn': current.fontname = tag.value || base.fontname; break
        case 'fs': current.fontsize = tag.value || base.fontsize; break
        case 'fscx': current.scaleX = tag.value; break
        case 'fscy': current.scaleY = tag.value; break
        case 'fsp': current.spacing = tag.value; break
        case 'frz': current.angle = tag.value; break
        case 'frx': current.angleX = tag.value; break
        case 'fry': current.angleY = tag.value; break
        case 'bord': current.outline = tag.value; break
        case 'shad': current.shadow = tag.value; break
        case 'blur': current.blur = tag.value; break
        case 'be': current.be = tag.value; break
        case 'c':
        case '1c': current.primaryColor = tag.value; break
        case '2c': current.secondaryColor = tag.value; break
        case '3c': current.outlineColor = tag.value; break
        case '4c': current.backColor = tag.value; break
        case 'alpha': {
          current.primaryAlpha = tag.value
          current.secondaryAlpha = tag.value
          current.outlineAlpha = tag.value
          current.backAlpha = tag.value
          break
        }
        case '1a': current.primaryAlpha = tag.value; break
        case '2a': current.secondaryAlpha = tag.value; break
        case '3a': current.outlineAlpha = tag.value; break
        case '4a': current.backAlpha = tag.value; break
        case 'p': current.drawingMode = tag.value; break
        case 'r': {
          const resetStyle = tag.value ? this.styleMap.get(tag.value) : null
          const src = resetStyle ? this.computeBaseStyle(resetStyle) : base
          Object.assign(current, src)
          break
        }
        case 't': {
          this.applyAnimation(tag.value, current, base, time, dialogue)
          break
        }
      }
    }
  }

  private applyAnimation(
    anim: ASSAnimation, current: ComputedStyle,
    base: ComputedStyle, time: number, dialogue: ASSDialogue,
  ): void {
    const elapsed = (time - dialogue.start) * 1000
    const duration = (dialogue.end - dialogue.start) * 1000
    const t1 = anim.t1 ?? 0
    const t2 = anim.t2 ?? duration
    const accel = anim.accel ?? 1

    if (elapsed < t1 || t2 <= t1) return

    let progress = Math.max(0, Math.min(1, (elapsed - t1) / (t2 - t1)))
    if (accel !== 1) progress = Math.pow(progress, accel)

    const snapshot = { ...current }

    for (const tag of anim.tags) {
      switch (tag.type) {
        case 'fs':
          current.fontsize = snapshot.fontsize + (tag.value - snapshot.fontsize) * progress
          break
        case 'fscx':
          current.scaleX = snapshot.scaleX + (tag.value - snapshot.scaleX) * progress
          break
        case 'fscy':
          current.scaleY = snapshot.scaleY + (tag.value - snapshot.scaleY) * progress
          break
        case 'frz':
          current.angle = snapshot.angle + (tag.value - snapshot.angle) * progress
          break
        case 'frx':
          current.angleX = snapshot.angleX + (tag.value - snapshot.angleX) * progress
          break
        case 'fry':
          current.angleY = snapshot.angleY + (tag.value - snapshot.angleY) * progress
          break
        case 'bord':
          current.outline = snapshot.outline + (tag.value - snapshot.outline) * progress
          break
        case 'shad':
          current.shadow = snapshot.shadow + (tag.value - snapshot.shadow) * progress
          break
        case 'blur':
          current.blur = snapshot.blur + (tag.value - snapshot.blur) * progress
          break
        case 'fsp':
          current.spacing = snapshot.spacing + (tag.value - snapshot.spacing) * progress
          break
        case 'c':
        case '1c':
          current.primaryColor = lerpColor(snapshot.primaryColor, tag.value, progress)
          break
        case '2c':
          current.secondaryColor = lerpColor(snapshot.secondaryColor, tag.value, progress)
          break
        case '3c':
          current.outlineColor = lerpColor(snapshot.outlineColor, tag.value, progress)
          break
        case '4c':
          current.backColor = lerpColor(snapshot.backColor, tag.value, progress)
          break
        case 'alpha':
          current.primaryAlpha = Math.round(snapshot.primaryAlpha + (tag.value - snapshot.primaryAlpha) * progress)
          current.secondaryAlpha = current.primaryAlpha
          current.outlineAlpha = current.primaryAlpha
          current.backAlpha = current.primaryAlpha
          break
        case '1a':
          current.primaryAlpha = Math.round(snapshot.primaryAlpha + (tag.value - snapshot.primaryAlpha) * progress)
          break
        case '3a':
          current.outlineAlpha = Math.round(snapshot.outlineAlpha + (tag.value - snapshot.outlineAlpha) * progress)
          break
        case 'clip': {
          // \t(\clip(...)) — animated clip handled at draw time via CSS
          break
        }
      }
    }
  }

  private collectKaraokeTimings(dialogue: ASSDialogue): number {
    return 0
  }

  private fillTextSpaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number): void {
    let cx = x
    for (const char of text) {
      ctx.fillText(char, cx, y)
      cx += ctx.measureText(char).width + spacing
    }
  }

  private strokeTextSpaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number): void {
    let cx = x
    for (const char of text) {
      ctx.strokeText(char, cx, y)
      cx += ctx.measureText(char).width + spacing
    }
  }

  private buildFont(style: ComputedStyle, fontSize: number): string {
    const weight = style.bold ? 'bold' : 'normal'
    const fontStyle = style.italic ? 'italic' : 'normal'
    const size = fontSize * (style.scaleY / 100)
    return `${fontStyle} ${weight} ${size}px "${style.fontname}", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif`
  }

  private computeBaseStyle(style: ASSStyle): ComputedStyle {
    return {
      fontname: style.fontname,
      fontsize: style.fontsize,
      primaryColor: style.primaryColor,
      secondaryColor: style.secondaryColor,
      outlineColor: style.outlineColor,
      backColor: style.backColor,
      bold: style.bold,
      italic: style.italic,
      underline: style.underline,
      strikeOut: style.strikeOut,
      scaleX: style.scaleX,
      scaleY: style.scaleY,
      spacing: style.spacing,
      angle: style.angle,
      angleX: 0,
      angleY: 0,
      borderStyle: style.borderStyle,
      outline: style.outline,
      shadow: style.shadow,
      alignment: style.alignment,
      marginL: style.marginL,
      marginR: style.marginR,
      marginV: style.marginV,
      alpha: 0,
      primaryAlpha: style.primaryColor.a,
      secondaryAlpha: style.secondaryColor.a,
      outlineAlpha: style.outlineColor.a,
      backAlpha: style.backColor.a,
      blur: 0,
      be: 0,
      drawingMode: 0,
      karaokeType: '',
      karaokeDuration: 0,
    }
  }

  private resolveStyle(name: string): ASSStyle {
    return this.styleMap.get(name.replace(/^\*/, '')) ?? this.getDefaultStyle()
  }

  private getDialogueLines(dialogue: ASSDialogue): ASSOverrideBlock[][] {
    const lines: ASSOverrideBlock[][] = [[]]

    for (const block of dialogue.overrides) {
      const parts = block.text.split(/\\N/g)
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) lines.push([])
        const text = parts[i]
        if (text || block.tags.length > 0) {
          lines[lines.length - 1].push({
            tags: i === 0 ? block.tags : [],
            text,
          })
        }
      }
    }

    return lines.filter(l => l.length > 0)
  }

  private getStaticPos(dialogue: ASSDialogue): [number, number] | null {
    for (const block of dialogue.overrides) {
      for (const tag of block.tags) {
        if (tag.type === 'pos') return tag.value
      }
    }
    return null
  }

  private getMove(dialogue: ASSDialogue): [number, number, number, number, number?, number?] | null {
    for (const block of dialogue.overrides) {
      for (const tag of block.tags) {
        if (tag.type === 'move') return tag.value
      }
    }
    return null
  }

  private getAlignment(dialogue: ASSDialogue, style: ASSStyle): number {
    for (const block of dialogue.overrides) {
      for (const tag of block.tags) {
        if (tag.type === 'an') return tag.value
        if (tag.type === 'a') return legacyAlignmentToASS(tag.value)
      }
    }
    return style.alignment
  }

  private getFad(dialogue: ASSDialogue): [number, number] | null {
    for (const block of dialogue.overrides) {
      for (const tag of block.tags) {
        if (tag.type === 'fad') return tag.value
      }
    }
    return null
  }

  private getFade(dialogue: ASSDialogue): [number, number, number, number, number, number, number] | null {
    for (const block of dialogue.overrides) {
      for (const tag of block.tags) {
        if (tag.type === 'fade') return tag.value
      }
    }
    return null
  }

  private getClip(dialogue: ASSDialogue): ASSClip | null {
    for (const block of dialogue.overrides) {
      for (const tag of block.tags) {
        if (tag.type === 'clip' || tag.type === 'iclip') return tag.value
      }
    }
    return null
  }

  private getOrg(dialogue: ASSDialogue): [number, number] | null {
    for (const block of dialogue.overrides) {
      for (const tag of block.tags) {
        if (tag.type === 'org') return tag.value
      }
    }
    return null
  }

  private getGlobalAngle(dialogue: ASSDialogue, style: ASSStyle): number {
    for (const block of dialogue.overrides) {
      for (const tag of block.tags) {
        if (tag.type === 'frz') return tag.value
      }
    }
    return style.angle
  }

  private getDefaultStyle(): ASSStyle {
    return {
      name: 'Default',
      fontname: 'Arial',
      fontsize: 20,
      primaryColor: { r: 255, g: 255, b: 255, a: 0 },
      secondaryColor: { r: 0, g: 0, b: 255, a: 0 },
      outlineColor: { r: 0, g: 0, b: 0, a: 0 },
      backColor: { r: 0, g: 0, b: 0, a: 128 },
      bold: false,
      italic: false,
      underline: false,
      strikeOut: false,
      scaleX: 100,
      scaleY: 100,
      spacing: 0,
      angle: 0,
      borderStyle: 1,
      outline: 2,
      shadow: 1,
      alignment: 2,
      marginL: 10,
      marginR: 10,
      marginV: 10,
      encoding: 0,
    }
  }
}

function assColorToCSS(color: ASSColor, alphaOverride?: number): string {
  const a = alphaOverride ?? color.a
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${Math.max(0, Math.min(1, 1 - a / 255))})`
}

function lerpColor(from: ASSColor, to: ASSColor, t: number): ASSColor {
  return {
    r: Math.round(from.r + (to.r - from.r) * t),
    g: Math.round(from.g + (to.g - from.g) * t),
    b: Math.round(from.b + (to.b - from.b) * t),
    a: Math.round(from.a + (to.a - from.a) * t),
  }
}

function legacyAlignmentToASS(a: number): number {
  const map: Record<number, number> = {
    1: 1, 2: 2, 3: 3, 5: 7, 6: 8, 7: 9, 9: 4, 10: 5, 11: 6,
  }
  return map[a] ?? 2
}
