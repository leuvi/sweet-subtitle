import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { SweetSubtitle } from '../SweetSubtitle'
import type { SubtitleCue, SubtitleFormat, SweetSubtitleOptions } from '../types'

export interface UseSweetSubtitleOptions extends Omit<SweetSubtitleOptions, 'src' | 'content'> {
  src?: string
  content?: string
  visible?: boolean
  onReady?: () => void
  onError?: (err: Error) => void
  onCueChange?: (cues: SubtitleCue[]) => void
}

export interface UseSweetSubtitleResult {
  subtitle: SweetSubtitle | null
  ready: boolean
  error: Error | null
  loadFromUrl: (url: string, format?: SubtitleFormat) => Promise<void>
  loadFromText: (content: string, format?: SubtitleFormat) => Promise<void>
  show: () => void
  hide: () => void
  setOffset: (seconds: number) => void
  destroy: () => void
}

export function useSweetSubtitle(
  videoRef: RefObject<HTMLVideoElement | null>,
  options: UseSweetSubtitleOptions = {}
): UseSweetSubtitleResult {
  const subtitleRef = useRef<SweetSubtitle | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const onReadyRef = useRef(options.onReady)
  const onErrorRef = useRef(options.onError)
  const onCueChangeRef = useRef(options.onCueChange)

  onReadyRef.current = options.onReady
  onErrorRef.current = options.onError
  onCueChangeRef.current = options.onCueChange

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const subtitle = new SweetSubtitle(video, {
      offset: options.offset,
      enableWasm: options.enableWasm,
    })
    subtitleRef.current = subtitle

    const offReady = subtitle.on('ready', () => {
      setReady(true)
      onReadyRef.current?.()
    })

    const offError = subtitle.on('error', (err) => {
      setError(err)
      onErrorRef.current?.(err)
    })

    const offCuechange = subtitle.on('cuechange', (cues) => {
      onCueChangeRef.current?.(cues)
    })

    if (options.visible === false) {
      subtitle.hide()
    }

    return () => {
      offReady()
      offError()
      offCuechange()
      subtitle.destroy()
      subtitleRef.current = null
    }
  }, [videoRef, options.enableWasm])

  useEffect(() => {
    if (subtitleRef.current && typeof options.offset === 'number') {
      subtitleRef.current.setOffset(options.offset)
    }
  }, [options.offset])

  useEffect(() => {
    if (!subtitleRef.current || typeof options.visible !== 'boolean') return
    if (options.visible) subtitleRef.current.show()
    else subtitleRef.current.hide()
  }, [options.visible])

  useEffect(() => {
    let cancelled = false
    const subtitle = subtitleRef.current
    if (!subtitle) return
    const currentSubtitle = subtitle

    async function load(): Promise<void> {
      try {
        setReady(false)
        setError(null)
        if (options.content) {
          await currentSubtitle.loadFromText(options.content, options.format)
          return
        }
        if (options.src) {
          await currentSubtitle.loadFromUrl(options.src, options.format)
        }
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error(String(err)))
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [options.src, options.content, options.format])

  const loadFromUrl = useCallback(async (url: string, format?: SubtitleFormat) => {
    const subtitle = subtitleRef.current
    if (!subtitle) throw new Error('SweetSubtitle is not initialized')
    setReady(false)
    setError(null)
    await subtitle.loadFromUrl(url, format)
  }, [])

  const loadFromText = useCallback(async (content: string, format?: SubtitleFormat) => {
    const subtitle = subtitleRef.current
    if (!subtitle) throw new Error('SweetSubtitle is not initialized')
    setReady(false)
    setError(null)
    await subtitle.loadFromText(content, format)
  }, [])

  const show = useCallback(() => {
    subtitleRef.current?.show()
  }, [])

  const hide = useCallback(() => {
    subtitleRef.current?.hide()
  }, [])

  const setOffset = useCallback((seconds: number) => {
    subtitleRef.current?.setOffset(seconds)
  }, [])

  const destroy = useCallback(() => {
    subtitleRef.current?.destroy()
    subtitleRef.current = null
  }, [])

  return {
    subtitle: subtitleRef.current,
    ready,
    error,
    loadFromUrl,
    loadFromText,
    show,
    hide,
    setOffset,
    destroy,
  }
}
