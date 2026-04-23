import { gaussian_blur, rasterize_drawing } from './wasm_module'
import init from './wasm_module'

type WasmModule = {
  gaussian_blur: (data: Uint8Array, width: number, height: number, radius: number) => void
  rasterize_drawing: (
    commands: string, scale: number, width: number, height: number,
    r: number, g: number, b: number, a: number,
  ) => Uint8Array
}

let wasmModule: WasmModule | null = null
let wasmLoading: Promise<void> | null = null

export function loadWasm(): void {
  if (wasmModule || wasmLoading) return

  wasmLoading = (async () => {
    try {
      await init()
      wasmModule = { gaussian_blur, rasterize_drawing }
    } catch (e) {
      console.warn('[sweet-subtitle] WASM unavailable, using JS fallback', e)
    }
  })()
}

export function getWasm(): WasmModule | null {
  return wasmModule
}

export function isWasmAvailable(): boolean {
  return wasmModule !== null
}

export function wasmGaussianBlur(imageData: ImageData, radius: number): ImageData {
  if (wasmModule) {
    const data = new Uint8Array(imageData.data.buffer)
    wasmModule.gaussian_blur(data, imageData.width, imageData.height, radius)
    return imageData
  }
  return cssBlurFallback(imageData, radius)
}

export function wasmRasterizeDrawing(
  commands: string, scale: number, width: number, height: number,
  r: number, g: number, b: number, a: number,
): Uint8Array | null {
  if (wasmModule) {
    return wasmModule.rasterize_drawing(commands, scale, width, height, r, g, b, a)
  }
  return null
}

function cssBlurFallback(imageData: ImageData, radius: number): ImageData {
  const canvas = new OffscreenCanvas(imageData.width, imageData.height)
  const ctx = canvas.getContext('2d')!
  ctx.putImageData(imageData, 0, 0)
  ctx.filter = `blur(${radius}px)`
  ctx.drawImage(canvas, 0, 0)
  return ctx.getImageData(0, 0, imageData.width, imageData.height)
}
