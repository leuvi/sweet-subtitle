export type SubtitleFormat = 'srt' | 'vtt' | 'ass'

export interface SubtitleCue {
  id: string
  start: number
  end: number
  text: string
  layer?: number
}

export interface SubtitleTrack {
  format: SubtitleFormat
  cues: SubtitleCue[]
}

export interface SRTCue extends SubtitleCue {
  format: 'srt'
}

export interface VTTCue extends SubtitleCue {
  format: 'vtt'
  settings?: VTTCueSettings
}

export interface VTTCueSettings {
  vertical?: 'rl' | 'lr'
  line?: string
  position?: string
  size?: string
  align?: 'start' | 'center' | 'end' | 'left' | 'right'
  region?: string
}

export interface VTTRegion {
  id: string
  width: number
  lines: number
  regionAnchorX: number
  regionAnchorY: number
  viewportAnchorX: number
  viewportAnchorY: number
  scroll?: 'up'
}

export interface VTTTrack extends SubtitleTrack {
  format: 'vtt'
  regions?: VTTRegion[]
  styles?: string[]
}

export interface ASSColor {
  r: number
  g: number
  b: number
  a: number
}

export interface ASSStyle {
  name: string
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
  borderStyle: number
  outline: number
  shadow: number
  alignment: number
  marginL: number
  marginR: number
  marginV: number
  encoding: number
}

export interface ASSScriptInfo {
  title?: string
  originalScript?: string
  scriptType?: string
  collisions?: string
  playResX: number
  playResY: number
  timer?: number
  wrapStyle?: number
  scaledBorderAndShadow?: boolean
  ycbcrMatrix?: string
  [key: string]: unknown
}

export interface ASSDialogue {
  layer: number
  start: number
  end: number
  style: string
  name: string
  marginL: number
  marginR: number
  marginV: number
  effect: string
  text: string
  overrides: ASSOverrideBlock[]
}

export interface ASSOverrideBlock {
  tags: ASSOverrideTag[]
  text: string
}

export type ASSOverrideTag =
  | { type: 'b'; value: number }
  | { type: 'i'; value: number }
  | { type: 'u'; value: number }
  | { type: 's'; value: number }
  | { type: 'fn'; value: string }
  | { type: 'fs'; value: number }
  | { type: 'fscx'; value: number }
  | { type: 'fscy'; value: number }
  | { type: 'fsp'; value: number }
  | { type: 'frz'; value: number }
  | { type: 'frx'; value: number }
  | { type: 'fry'; value: number }
  | { type: 'fe'; value: number }
  | { type: 'c'; value: ASSColor }
  | { type: '1c'; value: ASSColor }
  | { type: '2c'; value: ASSColor }
  | { type: '3c'; value: ASSColor }
  | { type: '4c'; value: ASSColor }
  | { type: 'alpha'; value: number }
  | { type: '1a'; value: number }
  | { type: '2a'; value: number }
  | { type: '3a'; value: number }
  | { type: '4a'; value: number }
  | { type: 'an'; value: number }
  | { type: 'a'; value: number }
  | { type: 'pos'; value: [number, number] }
  | { type: 'move'; value: [number, number, number, number, number?, number?] }
  | { type: 'org'; value: [number, number] }
  | { type: 'fad'; value: [number, number] }
  | { type: 'fade'; value: [number, number, number, number, number, number, number] }
  | { type: 'clip'; value: ASSClip }
  | { type: 'iclip'; value: ASSClip }
  | { type: 'bord'; value: number }
  | { type: 'xbord'; value: number }
  | { type: 'ybord'; value: number }
  | { type: 'shad'; value: number }
  | { type: 'xshad'; value: number }
  | { type: 'yshad'; value: number }
  | { type: 'blur'; value: number }
  | { type: 'be'; value: number }
  | { type: 'k'; value: number }
  | { type: 'kf'; value: number }
  | { type: 'ko'; value: number }
  | { type: 'K'; value: number }
  | { type: 'q'; value: number }
  | { type: 'r'; value: string }
  | { type: 'p'; value: number }
  | { type: 'pbo'; value: number }
  | { type: 't'; value: ASSAnimation }

export interface ASSClip {
  inverse: boolean
  rect?: [number, number, number, number]
  drawing?: string
  scale?: number
}

export interface ASSAnimation {
  t1?: number
  t2?: number
  accel?: number
  tags: ASSOverrideTag[]
}

export interface ASSTrack extends SubtitleTrack {
  format: 'ass'
  scriptInfo: ASSScriptInfo
  styles: ASSStyle[]
  dialogues: ASSDialogue[]
}

export interface SweetSubtitleOptions {
  src?: string
  content?: string
  format?: SubtitleFormat
  offset?: number
  enableWasm?: boolean
}

export type SweetSubtitleEvent = 'ready' | 'cuechange' | 'error'

export type SweetSubtitleEventMap = {
  ready: () => void
  cuechange: (cues: SubtitleCue[]) => void
  error: (err: Error) => void
}
