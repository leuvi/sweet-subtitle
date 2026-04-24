# sweet-subtitle

[![npm version](https://img.shields.io/npm/v/sweet-subtitle.svg)](https://www.npmjs.com/package/sweet-subtitle)
[![npm downloads](https://img.shields.io/npm/dw/sweet-subtitle.svg)](https://www.npmjs.com/package/sweet-subtitle)
[![GitHub stars](https://img.shields.io/github/stars/leuvi/sweet-subtitle?style=social)](https://github.com/leuvi/sweet-subtitle)
[![license](https://img.shields.io/npm/l/sweet-subtitle.svg)](./LICENSE)

Subtitle renderer and parser for web video, with full ASS/SSA support and multi-format parsing (SRT, WebVTT, SBV, TTML/DFXP), powered by Canvas 2D + Rust WASM.

One package for all usage modes:

- Core / Vanilla JS: `sweet-subtitle`
- React: `sweet-subtitle/react`
- Vue: `sweet-subtitle/vue`
- Angular: `sweet-subtitle/angular`

## Features

- **Multi-format** — SRT, WebVTT, ASS/SSA, SBV, TTML/DFXP
- **ASS advanced rendering** — styles, positioning (`\pos`, `\move`, `\org`), rotation (`\frz/frx/fry`), animation (`\t` with accel), karaoke (`\k/\kf/\ko`), clip (`\clip/\iclip`), drawing commands (`\p`), fade (`\fad/\fade`), per-character alpha, border styles, etc.
- **Gaussian blur** — `\blur` and `\be` rendered via Rust WASM (3-pass box blur), with CSS filter fallback
- **Text decorations** — underline (`\u`), strikeout (`\s`)
- **Scale transforms** — horizontal scale (`\fscx`), vertical scale (`\fscy`)
- **Auto text wrapping** — long lines wrap within video bounds
- **Encoding detection** — UTF-8, UTF-16LE/BE (with BOM), GBK auto-detection
- **Rust WASM bundled** — WASM binary ships inside the package, zero extra config for users
- **Lightweight** — zero runtime dependencies, tree-shakeable ESM/CJS dual output
- **Resilient parsing** — tolerates malformed ASS files (wrong Format lines, missing PlayRes, case-insensitive sections, BOM, flexible timestamps)

## Format Support

| Format | Parse | Render |
|--------|-------|--------|
| SRT | Yes | Yes |
| WebVTT | Yes | Yes |
| ASS/SSA | Yes | Yes (advanced effects) |
| SBV | Yes | Yes |
| TTML/DFXP | Yes | Yes |

## Install

```bash
npm install sweet-subtitle
```

The WASM binary is bundled inside the package — no extra setup needed.

Framework adapters are included in this same package via subpath imports.

## GitHub Discoverability Checklist

- Set repository topics: `subtitle`, `ass`, `srt`, `webvtt`, `ttml`, `wasm`, `react`, `vue`, `angular`, `video`.
- Keep release notes updated for each npm publish (see changelog and release template below).
- Pin a short usage snippet in repo description/About for quick conversion from visitors.

Release notes and history:

- Changelog: [CHANGELOG.md](./CHANGELOG.md)
- GitHub release template: [.github/RELEASE_TEMPLATE.md](./.github/RELEASE_TEMPLATE.md)

## Quick Start

```ts
import { SweetSubtitle } from 'sweet-subtitle'

const video = document.querySelector('video')
const sub = new SweetSubtitle(video, {
  src: '/path/to/subtitle.ass',
})

sub.on('ready', () => console.log('Subtitle loaded'))
sub.on('error', (err) => console.error(err))
```

Or use Promise-based loading for clearer async flow:

```ts
import { SweetSubtitle } from 'sweet-subtitle'

const video = document.querySelector('video')!
const sub = new SweetSubtitle(video, { enableWasm: true })

await sub.loadFromUrl('/path/to/subtitle.ass')
// await sub.loadFromText(subtitleText)
```

### Load from string

```ts
import { SweetSubtitle, decodeBuffer } from 'sweet-subtitle'

const buffer = await fetch('/sub.srt').then(r => r.arrayBuffer())
const content = decodeBuffer(buffer) // auto-detect encoding

const sub = new SweetSubtitle(video, { content })
```

### Parser only

```ts
import { parse, detectFormat } from 'sweet-subtitle'

const format = detectFormat(content) // 'srt' | 'vtt' | 'ass' | 'sbv' | 'ttml'
const track = parse(content)

console.log(track.cues) // [{ id, start, end, text }, ...]
```

## API

### `new SweetSubtitle(video, options?)`

| Option | Type | Description |
|--------|------|-------------|
| `src` | `string` | URL to subtitle file |
| `content` | `string` | Subtitle text content |
| `format` | `'srt' \| 'vtt' \| 'ass' \| 'sbv' \| 'ttml'` | Force format (auto-detected if omitted) |
| `offset` | `number` | Time offset in seconds |
| `encoding` | `string` | Force text decoding encoding for URL-loaded subtitles, e.g. `utf-8`, `utf-16le`, `gbk` |
| `fallbackEncodings` | `string[]` | Custom decode fallback chain for URL-loaded subtitles (default: `['gbk', 'big5', 'shift_jis']`) |

### Instance Methods

| Method | Description |
|--------|-------------|
| `loadFromUrl(url, format?)` | Load subtitle from URL, returns `Promise<void>` |
| `loadFromText(content, format?)` | Load subtitle from string, returns `Promise<void>` |
| `show()` | Show subtitle overlay |
| `hide()` | Hide subtitle overlay |
| `destroy()` | Remove overlay and stop rendering |
| `setOffset(seconds)` | Adjust subtitle timing |
| `once(event, callback)` | Subscribe once and auto-unsubscribe |
| `on(event, callback)` | Subscribe to events, returns `unsubscribe` |
| `off(event, callback)` | Unsubscribe |

Encoding notes:

- `decodeBuffer` auto-detects BOM (`utf-8`, `utf-16le`, `utf-16be`).
- For no-BOM files, it applies UTF-16 heuristic detection and UTF-8 validation.
- You can override detection using `encoding` and control fallback order using `fallbackEncodings`.

### Cross-framework Usage

#### Vanilla JS

```ts
const sub = new SweetSubtitle(videoEl)
const unsubscribe = sub.on('error', console.error)

await sub.loadFromUrl('/demo.srt')

// cleanup
unsubscribe()
sub.destroy()
```

#### React

```tsx
import { useEffect, useRef } from 'react'
import { useSweetSubtitle } from 'sweet-subtitle/react'

export function Player({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { error } = useSweetSubtitle(videoRef, { src, enableWasm: true })

  useEffect(() => {
    if (error) console.error(error)
  }, [error])

  return <video ref={videoRef} controls />
}
```

#### Vue 3

```ts
import { computed, ref, watch } from 'vue'
import { useSweetSubtitle } from 'sweet-subtitle/vue'

const videoRef = ref<HTMLVideoElement | null>(null)
const { error } = useSweetSubtitle(videoRef, {
  src: computed(() => props.subtitleUrl),
  enableWasm: true,
})

watch(error, (err) => {
  if (err) console.error(err)
})
```

#### Angular

```ts
import { Component } from '@angular/core'
import { SweetSubtitleDirective } from 'sweet-subtitle/angular'

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [SweetSubtitleDirective],
  template: `
    <video
      controls
      sweetSubtitle
      [subtitleSrc]="'/assets/demo.ass'"
      [subtitleEnableWasm]="true"
      (subtitleError)="onSubtitleError($event)">
    </video>
  `,
})
export class PlayerComponent {
  onSubtitleError(err: Error) {
    console.error(err)
  }
}
```

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `ready` | — | Track parsed and renderer initialized |
| `error` | `Error` | Parse or load failure |
| `cuechange` | `SubtitleCue[]` | Active cues changed |

## Project Structure

```
sweet-subtitle/
├── packages/
│   ├── core/                  # npm package "sweet-subtitle"
│   │   ├── scripts/
│   │   │   └── setup-wasm.mjs # copies wasm-pack output into src before build
│   │   └── src/
│   │       ├── parser/        # SRT / VTT / ASS parsers
│   │       ├── renderer/      # Canvas 2D renderers (text + ASS)
│   │       ├── wasm/          # WASM bridge (lazy-load, JS fallback)
│   │       ├── SweetSubtitle.ts
│   │       ├── encoding.ts    # Encoding detection (UTF-8/16/GBK)
│   │       └── types.ts
│   └── wasm/                  # Rust WASM crate
│       └── src/
│           ├── blur.rs        # Gaussian blur (3-pass box blur)
│           └── drawing.rs     # ASS drawing command rasterizer
└── playground/                # Vite + React + Tailwind demo app
```

## Development

```bash
# Install dependencies
pnpm install

# Build WASM (requires Rust + wasm-pack)
pnpm build:wasm

# Build the library
pnpm build

# Run playground
pnpm dev

# Type check
pnpm typecheck

# Run tests
pnpm test

# Dry run publish (recommended)
pnpm run release:dry

# Publish single package to npm (sweet-subtitle)
pnpm run release
```

> **Note:** This repo now publishes one npm package only: `sweet-subtitle`. React/Vue/Angular adapters are included as subpath exports (`sweet-subtitle/react`, `sweet-subtitle/vue`, `sweet-subtitle/angular`).
>
> `pnpm build:wasm` must be run at least once before `pnpm build` or `pnpm run release`. The `prepublishOnly` hook rebuilds WASM automatically on every publish.

## Supported ASS Override Tags

| Tag | Description |
|-----|-------------|
| `\b`, `\i`, `\u`, `\s` | Bold, italic, underline, strikeout |
| `\fn`, `\fs`, `\fsp` | Font name, size, spacing |
| `\fscx`, `\fscy` | Scale X/Y |
| `\frz`, `\frx`, `\fry` | Rotation Z/X/Y |
| `\c`, `\1c`-`\4c` | Colors (primary, secondary, outline, shadow) |
| `\alpha`, `\1a`-`\4a` | Alpha channels |
| `\bord`, `\shad` | Border, shadow |
| `\blur`, `\be` | Gaussian blur (WASM-accelerated) |
| `\pos`, `\move`, `\org` | Position, animation, rotation origin |
| `\an`, `\a` | Alignment (numpad / legacy) |
| `\fad`, `\fade` | Fade in/out (2-param and 7-param) |
| `\clip`, `\iclip` | Rectangular / drawing clip |
| `\t` | Animation with accel curve |
| `\k`, `\kf`, `\ko`, `\K` | Karaoke effects |
| `\p` | Drawing mode |
| `\r` | Style reset |

## License

MIT
