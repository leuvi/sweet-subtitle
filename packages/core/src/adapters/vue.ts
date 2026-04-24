import { onBeforeUnmount, onMounted, ref, unref, watch } from 'vue'
import type { Ref } from 'vue'
import { SweetSubtitle } from '../SweetSubtitle'
import type { SubtitleCue, SubtitleFormat, SweetSubtitleOptions } from '../types'

type MaybeRef<T> = T | Ref<T>

export interface UseSweetSubtitleOptions extends Omit<SweetSubtitleOptions, 'src' | 'content' | 'format'> {
  src?: MaybeRef<string | undefined>
  content?: MaybeRef<string | undefined>
  format?: MaybeRef<SubtitleFormat | undefined>
  visible?: MaybeRef<boolean | undefined>
  onReady?: () => void
  onError?: (err: Error) => void
  onCueChange?: (cues: SubtitleCue[]) => void
}

export function useSweetSubtitle(
  videoRef: Ref<HTMLVideoElement | null>,
  options: UseSweetSubtitleOptions = {}
) {
  const subtitle = ref<SweetSubtitle | null>(null)
  const ready = ref(false)
  const error = ref<Error | null>(null)

  async function loadFromUrl(url: string, format?: SubtitleFormat): Promise<void> {
    if (!subtitle.value) throw new Error('SweetSubtitle is not initialized')
    ready.value = false
    error.value = null
    await subtitle.value.loadFromUrl(url, format)
  }

  async function loadFromText(content: string, format?: SubtitleFormat): Promise<void> {
    if (!subtitle.value) throw new Error('SweetSubtitle is not initialized')
    ready.value = false
    error.value = null
    await subtitle.value.loadFromText(content, format)
  }

  function show(): void {
    subtitle.value?.show()
  }

  function hide(): void {
    subtitle.value?.hide()
  }

  function setOffset(seconds: number): void {
    subtitle.value?.setOffset(seconds)
  }

  function destroy(): void {
    subtitle.value?.destroy()
    subtitle.value = null
  }

  onMounted(() => {
    const video = videoRef.value
    if (!video) return

    const instance = new SweetSubtitle(video, {
      offset: options.offset,
      enableWasm: options.enableWasm,
    })

    subtitle.value = instance

    const offReady = instance.on('ready', () => {
      ready.value = true
      options.onReady?.()
    })

    const offError = instance.on('error', (err) => {
      error.value = err
      options.onError?.(err)
    })

    const offCuechange = instance.on('cuechange', (cues) => {
      options.onCueChange?.(cues)
    })

    watch(
      () => options.offset,
      (offset) => {
        if (typeof offset === 'number') {
          instance.setOffset(offset)
        }
      },
      { immediate: true }
    )

    watch(
      () => unref(options.visible),
      (visible) => {
        if (typeof visible !== 'boolean') return
        if (visible) instance.show()
        else instance.hide()
      },
      { immediate: true }
    )

    watch(
      [
        () => unref(options.src),
        () => unref(options.content),
        () => unref(options.format),
      ],
      async ([src, content, format]) => {
        try {
          ready.value = false
          error.value = null

          if (content) {
            await instance.loadFromText(content, format)
            return
          }

          if (src) {
            await instance.loadFromUrl(src, format)
          }
        } catch (err) {
          error.value = err instanceof Error ? err : new Error(String(err))
        }
      },
      { immediate: true }
    )

    onBeforeUnmount(() => {
      offReady()
      offError()
      offCuechange()
      instance.destroy()
      subtitle.value = null
    })
  })

  return {
    subtitle,
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
