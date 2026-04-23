# sweet-subtitle

Browser subtitle rendering library with full ASS/SSA support, powered by Canvas 2D + Rust WASM.

## Features

- **Multi-format** — SRT, WebVTT, ASS/SSA
- **ASS advanced rendering** — styles, positioning (`\pos`, `\move`, `\org`), rotation (`\frz/frx/fry`), animation (`\t` with accel), karaoke (`\k/\kf/\ko`), clip (`\clip/\iclip`), drawing commands (`\p`), fade (`\fad/\fade`), per-character alpha, border styles, etc.
- **Gaussian blur** — `\blur` and `\be` rendered via Rust WASM (3-pass box blur), with CSS filter fallback
- **Text decorations** — underline (`\u`), strikeout (`\s`)
- **Scale transforms** — horizontal scale (`\fscx`), vertical scale (`\fscy`)
- **Auto text wrapping** — long lines wrap within video bounds
- **Encoding detection** — UTF-8, UTF-16LE/BE (with BOM), GBK auto-detection
- **Rust WASM bundled** — WASM binary ships inside the package, zero extra config for users
- **Lightweight** — zero runtime dependencies, tree-shakeable ESM/CJS dual output
- **Resilient parsing** — tolerates malformed ASS files (wrong Format lines, missing PlayRes, case-insensitive sections, BOM, flexible timestamps)

## Install

```bash
npm install sweet-subtitle
```

The WASM binary is bundled inside the package — no extra setup needed.

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

const format = detectFormat(content) // 'srt' | 'vtt' | 'ass'
const track = parse(content)

console.log(track.cues) // [{ id, start, end, text }, ...]
```

## API

### `new SweetSubtitle(video, options?)`

| Option | Type | Description |
|--------|------|-------------|
| `src` | `string` | URL to subtitle file |
| `content` | `string` | Subtitle text content |
| `format` | `'srt' \| 'vtt' \| 'ass'` | Force format (auto-detected if omitted) |
| `offset` | `number` | Time offset in seconds |

### Instance Methods

| Method | Description |
|--------|-------------|
| `show()` | Show subtitle overlay |
| `hide()` | Hide subtitle overlay |
| `destroy()` | Remove overlay and stop rendering |
| `setOffset(seconds)` | Adjust subtitle timing |
| `on(event, callback)` | Subscribe to events |
| `off(event, callback)` | Unsubscribe |

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

# Publish to npm (bumps version first, then builds + publishes)
pnpm run release
```

> **Note:** `pnpm build:wasm` must be run at least once before `pnpm build` or `pnpm run release`. The `prepublishOnly` hook rebuilds WASM automatically on every publish.

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
