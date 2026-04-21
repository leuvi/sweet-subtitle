type WasmModule = {
  gaussian_blur: (data: Uint8Array, width: number, height: number, radius: number) => void
  rasterize_drawing: (
    commands: string, scale: number, width: number, height: number,
    r: number, g: number, b: number, a: number,
  ) => Uint8Array
}

let wasmModule: WasmModule | null = null
let wasmLoading: Promise<WasmModule | null> | null = null
let wasmFailed = false

export async function loadWasm(): Promise<WasmModule | null> {
  if (wasmModule) return wasmModule
  if (wasmFailed) return null
  if (wasmLoading) return wasmLoading

  wasmLoading = (async () => {
    try {
      // @ts-ignore — WASM module resolved at build time
      const wasm = await import('sweet-subtitle-wasm')
      await wasm.default()
      wasmModule = {
        gaussian_blur: wasm.gaussian_blur,
        rasterize_drawing: wasm.rasterize_drawing,
      }
      return wasmModule
    } catch {
      wasmFailed = true
      return null
    }
  })()

  return wasmLoading
}

export function getWasm(): WasmModule | null {
  return wasmModule
}

export function isWasmAvailable(): boolean {
  return wasmModule !== null
}

export async function wasmGaussianBlur(
  imageData: ImageData,
  radius: number,
): Promise<ImageData> {
  const wasm = await loadWasm()
  if (wasm) {
    const data = new Uint8Array(imageData.data.buffer)
    wasm.gaussian_blur(data, imageData.width, imageData.height, radius)
    return imageData
  }
  return cssBlurFallback(imageData, radius)
}

export async function wasmRasterizeDrawing(
  commands: string, scale: number, width: number, height: number,
  r: number, g: number, b: number, a: number,
): Promise<Uint8Array | null> {
  const wasm = await loadWasm()
  if (wasm) {
    return wasm.rasterize_drawing(commands, scale, width, height, r, g, b, a)
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
