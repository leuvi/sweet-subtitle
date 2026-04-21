import type { SubtitleCue, SubtitleFormat, SubtitleTrack, SweetSubtitleEventMap, SweetSubtitleOptions } from './types'
import { parse, detectFormat } from './parser'
import { BaseRenderer } from './renderer/base'
import { TextRenderer } from './renderer/text'
import { ASSRenderer } from './renderer/ass/index'
import { decodeBuffer } from './encoding'
import type { ASSTrack } from './parser'

export class SweetSubtitle {
  private video: HTMLVideoElement
  private renderer: BaseRenderer | null = null
  private track: SubtitleTrack | null = null
  private offset = 0
  private rafId = 0
  private resizeObserver: ResizeObserver | null = null
  private listeners = new Map<string, Set<Function>>()
  private destroyed = false

  constructor(video: HTMLVideoElement, options?: SweetSubtitleOptions) {
    this.video = video
    this.offset = options?.offset ?? 0

    if (options?.content) {
      this.loadContent(options.content, options.format)
    } else if (options?.src) {
      this.loadURL(options.src, options.format)
    }
  }

  private async loadURL(url: string, format?: SubtitleFormat): Promise<void> {
    try {
      const response = await fetch(url)
      const buffer = await response.arrayBuffer()
      const content = decodeBuffer(buffer)
      this.loadContent(content, format)
    } catch (err) {
      this.emit('error', err instanceof Error ? err : new Error(String(err)))
    }
  }

  private loadContent(content: string, format?: SubtitleFormat): void {
    try {
      this.track = parse(content, format)
      this.setupRenderer()
      this.emit('ready')
    } catch (err) {
      this.emit('error', err instanceof Error ? err : new Error(String(err)))
    }
  }

  private setupRenderer(): void {
    if (this.renderer) {
      this.renderer.destroy()
    }

    if (this.track?.format === 'ass') {
      this.renderer = new ASSRenderer(this.video)
      ;(this.renderer as ASSRenderer).setTrack(this.track as ASSTrack)
    } else if (this.track) {
      this.renderer = new TextRenderer(this.video)
      this.renderer.setTrack(this.track)
    }

    if (this.renderer) {
      this.renderer.mount()
      this.startLoop()
      this.observeResize()
    }
  }

  private startLoop(): void {
    this.stopLoop()
    const tick = () => {
      if (this.destroyed) return
      const time = this.video.currentTime + this.offset
      const cues = this.renderer?.render(time) ?? []
      this.emit('cuechange', cues)
      this.rafId = requestAnimationFrame(tick)
    }
    this.rafId = requestAnimationFrame(tick)
  }

  private stopLoop(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = 0
    }
  }

  private observeResize(): void {
    this.resizeObserver?.disconnect()
    this.resizeObserver = new ResizeObserver(() => {
      this.renderer?.syncSize()
    })
    this.resizeObserver.observe(this.video)
  }

  setTrack(content: string, format?: SubtitleFormat): void {
    this.loadContent(content, format)
  }

  setOffset(seconds: number): void {
    this.offset = seconds
  }

  show(): void {
    this.renderer?.show()
  }

  hide(): void {
    this.renderer?.hide()
  }

  resize(): void {
    this.renderer?.syncSize()
  }

  on<K extends keyof SweetSubtitleEventMap>(event: K, handler: SweetSubtitleEventMap[K]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
  }

  off<K extends keyof SweetSubtitleEventMap>(event: K, handler: SweetSubtitleEventMap[K]): void {
    this.listeners.get(event)?.delete(handler)
  }

  private emit(event: string, ...args: unknown[]): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      for (const handler of handlers) {
        (handler as Function)(...args)
      }
    }
  }

  getTrack(): SubtitleTrack | null {
    return this.track
  }

  destroy(): void {
    this.destroyed = true
    this.stopLoop()
    this.resizeObserver?.disconnect()
    this.renderer?.destroy()
    this.listeners.clear()
  }
}
