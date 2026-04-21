import type { SubtitleCue, SubtitleTrack } from '../types'

export abstract class BaseRenderer {
  protected canvas: HTMLCanvasElement
  protected ctx: CanvasRenderingContext2D
  protected video: HTMLVideoElement
  protected track: SubtitleTrack | null = null
  protected activeCues: SubtitleCue[] = []
  protected visible = true

  constructor(video: HTMLVideoElement) {
    this.video = video
    this.canvas = document.createElement('canvas')
    this.ctx = this.canvas.getContext('2d')!
    this.canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;'
    this.syncSize()
  }

  mount(): void {
    const parent = this.video.parentElement
    if (!parent) throw new Error('Video element must have a parent')
    if (!parent.style.position || parent.style.position === 'static') {
      parent.style.position = 'relative'
    }
    parent.appendChild(this.canvas)
  }

  unmount(): void {
    this.canvas.remove()
  }

  setTrack(track: SubtitleTrack): void {
    this.track = track
  }

  syncSize(): void {
    const { videoWidth, videoHeight, clientWidth, clientHeight } = this.video
    const dpr = window.devicePixelRatio || 1
    this.canvas.width = clientWidth * dpr
    this.canvas.height = clientHeight * dpr
    this.canvas.style.width = `${clientWidth}px`
    this.canvas.style.height = `${clientHeight}px`
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  show(): void { this.visible = true }
  hide(): void { this.visible = false; this.clear() }

  render(time: number): SubtitleCue[] {
    if (!this.track || !this.visible) {
      this.clear()
      return []
    }
    this.activeCues = this.track.cues.filter(c => time >= c.start && time <= c.end)
    this.clear()
    if (this.activeCues.length > 0) {
      this.draw(this.activeCues, time)
    }
    return this.activeCues
  }

  protected clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  protected abstract draw(cues: SubtitleCue[], time: number): void

  destroy(): void {
    this.unmount()
  }
}
