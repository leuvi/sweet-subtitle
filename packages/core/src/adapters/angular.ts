import { AfterViewInit, Directive, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output } from '@angular/core'
import type { SimpleChanges } from '@angular/core'
import { SweetSubtitle } from '../SweetSubtitle'
import type { SubtitleCue, SubtitleFormat } from '../types'

@Directive({
  selector: 'video[sweetSubtitle]',
  standalone: true,
})
export class SweetSubtitleDirective implements AfterViewInit, OnChanges, OnDestroy {
  @Input() subtitleSrc?: string
  @Input() subtitleContent?: string
  @Input() subtitleFormat?: SubtitleFormat
  @Input() subtitleOffset = 0
  @Input() subtitleVisible = true
  @Input() subtitleEnableWasm = false

  @Output() subtitleReady = new EventEmitter<void>()
  @Output() subtitleError = new EventEmitter<Error>()
  @Output() subtitleCueChange = new EventEmitter<SubtitleCue[]>()

  private subtitle: SweetSubtitle | null = null
  private offReady?: () => void
  private offError?: () => void
  private offCuechange?: () => void

  constructor(private readonly host: ElementRef<HTMLVideoElement>) {}

  ngAfterViewInit(): void {
    this.subtitle = new SweetSubtitle(this.host.nativeElement, {
      offset: this.subtitleOffset,
      enableWasm: this.subtitleEnableWasm,
    })

    this.offReady = this.subtitle.on('ready', () => {
      this.subtitleReady.emit()
    })

    this.offError = this.subtitle.on('error', (err) => {
      this.subtitleError.emit(err)
    })

    this.offCuechange = this.subtitle.on('cuechange', (cues) => {
      this.subtitleCueChange.emit(cues)
    })

    this.syncVisibility()
    void this.syncSource()
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.subtitle) return

    if (changes['subtitleOffset']) {
      this.subtitle.setOffset(this.subtitleOffset)
    }

    if (changes['subtitleVisible']) {
      this.syncVisibility()
    }

    if (changes['subtitleSrc'] || changes['subtitleContent'] || changes['subtitleFormat']) {
      void this.syncSource()
    }
  }

  async loadFromUrl(url: string, format?: SubtitleFormat): Promise<void> {
    if (!this.subtitle) throw new Error('SweetSubtitle is not initialized')
    await this.subtitle.loadFromUrl(url, format)
  }

  async loadFromText(content: string, format?: SubtitleFormat): Promise<void> {
    if (!this.subtitle) throw new Error('SweetSubtitle is not initialized')
    await this.subtitle.loadFromText(content, format)
  }

  ngOnDestroy(): void {
    this.offReady?.()
    this.offError?.()
    this.offCuechange?.()
    this.subtitle?.destroy()
    this.subtitle = null
  }

  private syncVisibility(): void {
    if (!this.subtitle) return
    if (this.subtitleVisible) this.subtitle.show()
    else this.subtitle.hide()
  }

  private async syncSource(): Promise<void> {
    if (!this.subtitle) return
    if (this.subtitleContent) {
      await this.subtitle.loadFromText(this.subtitleContent, this.subtitleFormat)
      return
    }
    if (this.subtitleSrc) {
      await this.subtitle.loadFromUrl(this.subtitleSrc, this.subtitleFormat)
    }
  }
}
