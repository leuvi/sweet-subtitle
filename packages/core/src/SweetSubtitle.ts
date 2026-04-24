import type { SubtitleCue, SubtitleFormat, SubtitleTrack, SweetSubtitleEventMap, SweetSubtitleOptions } from './types'
import { parse, detectFormat } from './parser'
import { BaseRenderer } from './renderer/base'
import { TextRenderer } from './renderer/text'
import { ASSRenderer } from './renderer/ass/index'
import { decodeBuffer } from './encoding'
import { setWasmEnabled } from './wasm/bridge'
import type { ASSTrack } from './parser'

export class SweetSubtitle {
  private video: HTMLVideoElement
  private renderer: BaseRenderer | null = null
  private track: SubtitleTrack | null = null
  private offset = 0
  private encoding?: string
  private fallbackEncodings?: string[]
  private rafId = 0
  private resizeObserver: ResizeObserver | null = null
  private listeners = new Map<string, Set<Function>>()
  private destroyed = false

  constructor(video: HTMLVideoElement, options?: SweetSubtitleOptions) {
    this.video = video
    this.offset = options?.offset ?? 0
    this.encoding = options?.encoding
    this.fallbackEncodings = options?.fallbackEncodings
    setWasmEnabled(options?.enableWasm ?? false)

    if (options?.content) {
      void this.loadFromText(options.content, options.format)
    } else if (options?.src) {
      void this.loadFromUrl(options.src, options.format)
    }
  }

  async loadFromUrl(url: string, format?: SubtitleFormat): Promise<void> {
    try {
      const response = await fetch(url)
      const buffer = await response.arrayBuffer()
      const content = decodeBuffer(buffer, {
        forceEncoding: this.encoding,
        fallbackEncodings: this.fallbackEncodings,
      })
      this.loadContent(content, format)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      this.emit('error', error)
      throw error
    }
  }

  async loadFromText(content: string, format?: SubtitleFormat): Promise<void> {
    try {
      this.loadContent(content, format)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      this.emit('error', error)
      throw error
    }
  }

  private loadContent(content: string, format?: SubtitleFormat): void {
    this.track = parse(content, format)
    this.setupRenderer()
    this.emit('ready')
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
    void this.loadFromText(content, format)
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

  on<K extends keyof SweetSubtitleEventMap>(event: K, handler: SweetSubtitleEventMap[K]): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
    return () => this.off(event, handler)
  }

  once<K extends keyof SweetSubtitleEventMap>(event: K, handler: SweetSubtitleEventMap[K]): () => void {
    const onceHandler = ((...args: unknown[]) => {
      this.off(event, onceHandler as SweetSubtitleEventMap[K])
      ;(handler as Function)(...args)
    }) as SweetSubtitleEventMap[K]

    return this.on(event, onceHandler)
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
