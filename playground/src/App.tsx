import { useRef, useState, useCallback, useEffect } from 'react'
import { SweetSubtitle, parse, decodeBuffer } from 'sweet-subtitle'
import type { ASSTrack } from 'sweet-subtitle'

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const subRef = useRef<SweetSubtitle | null>(null)
  const lastContentRef = useRef<string>('')
  const [videoUrl, setVideoUrl] = useState('')
  const [subtitleName, setSubtitleName] = useState('')
  const [offset, setOffset] = useState(0)
  const [visible, setVisible] = useState(true)
  const [ready, setReady] = useState(false)
  const [trackInfo, setTrackInfo] = useState<{
    format: string
    cueCount: number
    styles?: number
    playRes?: string
  } | null>(null)
  const [activeCueCount, setActiveCueCount] = useState(0)
  const [error, setError] = useState('')
  const [dimVideo, setDimVideo] = useState(false)
  const [wasmEnabled, setWasmEnabled] = useState(false)
  const [showFps, setShowFps] = useState(false)
  const [fps, setFps] = useState(0)

  const mountSubtitle = useCallback((content: string, useWasm: boolean) => {
    if (!videoRef.current) return
    setError('')
    setReady(false)

    try {
      const track = parse(content)
      const info: typeof trackInfo = {
        format: track.format.toUpperCase(),
        cueCount: track.cues.length,
      }
      if (track.format === 'ass') {
        const ass = track as ASSTrack
        info.styles = ass.styles.length
        info.playRes = `${ass.scriptInfo.playResX}x${ass.scriptInfo.playResY}`
      }
      setTrackInfo(info)

      subRef.current?.destroy()
      const sub = new SweetSubtitle(videoRef.current, { content, enableWasm: useWasm })
      sub.on('ready', () => setReady(true))
      sub.on('error', (err) => setError(err.message))
      sub.on('cuechange', (cues) => setActiveCueCount(cues.length))
      subRef.current = sub
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  const handleVideoFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoUrl(URL.createObjectURL(file))
  }, [videoUrl])

  const handleSubtitleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const buffer = await file.arrayBuffer()
    const content = decodeBuffer(buffer)
    lastContentRef.current = content
    setSubtitleName(file.name)
    mountSubtitle(content, wasmEnabled)
  }, [wasmEnabled, mountSubtitle])

  const toggleWasm = useCallback(() => {
    const next = !wasmEnabled
    setWasmEnabled(next)
    if (lastContentRef.current) {
      mountSubtitle(lastContentRef.current, next)
    }
  }, [wasmEnabled, mountSubtitle])

  // FPS counter — only samples while enabled to avoid unnecessary updates.
  useEffect(() => {
    if (!showFps) {
      setFps(0)
      return
    }

    let rafId = 0
    let frames = 0
    let lastSample = performance.now()

    const tick = () => {
      frames++
      const now = performance.now()
      const elapsed = now - lastSample
      if (elapsed >= 500) {
        setFps(Math.round((frames * 1000) / elapsed))
        frames = 0
        lastSample = now
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [showFps])

  useEffect(() => {
    return () => {
      subRef.current?.destroy()
      if (videoUrl) URL.revokeObjectURL(videoUrl)
    }
  }, [])

  useEffect(() => { subRef.current?.setOffset(offset) }, [offset])
  useEffect(() => {
    if (visible) subRef.current?.show()
    else subRef.current?.hide()
  }, [visible])

  const fpsColor = fps >= 55 ? 'text-emerald-400' : fps >= 30 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-1">sweet-subtitle</h1>
        <p className="text-gray-500 text-sm mb-6">Browser subtitle library playground</p>

        <div className="flex gap-3 mb-4 flex-wrap items-center">
          <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg cursor-pointer hover:bg-blue-700 transition text-sm font-medium">
            Video
            <input type="file" accept="video/*" onChange={handleVideoFile} className="hidden" />
          </label>

          <label className="flex items-center gap-2 px-4 py-2 bg-emerald-600 rounded-lg cursor-pointer hover:bg-emerald-700 transition text-sm font-medium">
            Subtitle
            <input type="file" accept=".srt,.vtt,.ass,.ssa,.sbv,.ttml,.dfxp" onChange={handleSubtitleFile} className="hidden" />
          </label>

          {subtitleName && (
            <span className="px-3 py-1.5 bg-gray-800 rounded text-xs text-gray-300 font-mono">
              {subtitleName}
              {ready && <span className="ml-2 text-emerald-400">ready</span>}
            </span>
          )}

          {error && (
            <span className="px-3 py-1.5 bg-red-900/50 rounded text-xs text-red-300">
              {error}
            </span>
          )}
        </div>

        <div className="flex gap-3 mb-4 items-center flex-wrap">
          <label className="flex items-center gap-2 text-sm text-gray-400">
            Offset
            <input
              type="number"
              step="0.1"
              value={offset}
              onChange={(e) => setOffset(Number(e.target.value))}
              className="w-20 px-2 py-1 bg-gray-800 rounded border border-gray-700 text-white text-sm"
            />
            <span className="text-xs">s</span>
          </label>

          <button
            onClick={() => setVisible(!visible)}
            className={`px-3 py-1 rounded text-sm transition ${
              visible ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-700 hover:bg-red-600'
            }`}
          >
            {visible ? 'Visible' : 'Hidden'}
          </button>

          <button
            onClick={() => setDimVideo(!dimVideo)}
            className={`px-3 py-1 rounded text-sm transition ${
              dimVideo ? 'bg-purple-700 hover:bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            Dim
          </button>

          <button
            onClick={toggleWasm}
            className={`px-3 py-1 rounded text-sm transition font-mono ${
              wasmEnabled ? 'bg-orange-600 hover:bg-orange-500' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title="Toggle WASM blur/drawing (reloads subtitle)"
          >
            WASM: {wasmEnabled ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={() => setShowFps(!showFps)}
            className={`px-3 py-1 rounded text-sm transition font-mono ${
              showFps ? 'bg-cyan-700 hover:bg-cyan-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title="Toggle FPS monitor"
          >
            FPS: {showFps ? 'ON' : 'OFF'}
          </button>

          {showFps && (
            <span className={`px-2 py-1 bg-gray-900 rounded text-xs font-mono ${fpsColor}`}>
              {fps} fps
            </span>
          )}

          {trackInfo && (
            <div className="flex gap-2 text-xs text-gray-500">
              <span className="px-2 py-0.5 bg-gray-800 rounded">{trackInfo.format}</span>
              <span className="px-2 py-0.5 bg-gray-800 rounded">{trackInfo.cueCount} cues</span>
              {trackInfo.styles !== undefined && (
                <span className="px-2 py-0.5 bg-gray-800 rounded">{trackInfo.styles} styles</span>
              )}
              {trackInfo.playRes && (
                <span className="px-2 py-0.5 bg-gray-800 rounded">{trackInfo.playRes}</span>
              )}
              {activeCueCount > 0 && (
                <span className="px-2 py-0.5 bg-emerald-900 text-emerald-300 rounded">
                  {activeCueCount} active
                </span>
              )}
            </div>
          )}
        </div>

        <div className="relative bg-black rounded-lg overflow-hidden">
          {videoUrl ? (
            <>
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                className="w-full"
              />
              {dimVideo && (
                <div className="absolute inset-0 bg-black/70 pointer-events-none" />
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-gray-600 gap-2">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Select a video file to start</span>
            </div>
          )}
        </div>

        <div className="mt-6 text-xs text-gray-600">
          Supported formats: SRT, WebVTT, ASS/SSA, SBV, TTML/DFXP (ASS with advanced rendering)
        </div>
      </div>
    </div>
  )
}
