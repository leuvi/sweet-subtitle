mod blur;
mod drawing;

use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

pub use blur::gaussian_blur;
pub use drawing::rasterize_drawing;
