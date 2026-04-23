import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkgDir = join(__dirname, '../../wasm/pkg')
const outDir = join(__dirname, '../src/wasm')

const wasmJs  = join(pkgDir, 'sweet_subtitle_wasm.js')
const wasmDts = join(pkgDir, 'sweet_subtitle_wasm.d.ts')
const outMod  = join(outDir, 'wasm_module.js')
const outDts  = join(outDir, 'wasm_module.d.ts')

if (!existsSync(wasmJs)) {
  writeFileSync(outMod, '// wasm not built\nexport function initSync() {}\nexport function gaussian_blur() {}\nexport function rasterize_drawing() { return new Uint8Array(0) }\nexport default async function init() {}\n')
  writeFileSync(outDts, 'export function initSync(bytes: ArrayBuffer): void\nexport function gaussian_blur(data: Uint8Array, width: number, height: number, radius: number): void\nexport function rasterize_drawing(commands: string, scale: number, width: number, height: number, r: number, g: number, b: number, a: number): Uint8Array\nexport default function init(): Promise<void>\n')
  console.warn('[setup-wasm] WASM not built — stubs written. Run pnpm build:wasm first.')
  process.exit(0)
}

copyFileSync(wasmJs, outMod)
copyFileSync(wasmDts, outDts)
console.log('[setup-wasm] JS wrapper copied to src/wasm/')
