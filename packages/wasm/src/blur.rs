use wasm_bindgen::prelude::*;

/// Two-pass box blur approximating Gaussian blur.
/// Operates on RGBA pixel data in-place.
/// Uses 3 passes for better approximation.
#[wasm_bindgen]
pub fn gaussian_blur(data: &mut [u8], width: u32, height: u32, radius: f32) {
    if radius <= 0.0 || width == 0 || height == 0 {
        return;
    }

    let w = width as usize;
    let h = height as usize;

    let boxes = boxes_for_gauss(radius, 3);

    for &box_r in &boxes {
        box_blur(data, w, h, box_r);
    }
}

fn boxes_for_gauss(sigma: f32, n: usize) -> Vec<usize> {
    let w_ideal = ((12.0 * sigma * sigma / n as f32) + 1.0).sqrt();
    let mut wl = w_ideal.floor() as usize;
    if wl % 2 == 0 {
        wl -= 1;
    }
    let wu = wl + 2;
    let m_ideal =
        (12.0 * sigma * sigma - (n * wl * wl + 4 * n * wl + 3 * n) as f32) / (-4.0 * wl as f32 - 4.0);
    let m = m_ideal.round() as usize;

    (0..n).map(|i| if i < m { wl } else { wu }).collect()
}

fn box_blur(data: &mut [u8], w: usize, h: usize, radius: usize) {
    if radius == 0 {
        return;
    }

    let mut temp = data.to_vec();

    box_blur_h(data, &mut temp, w, h, radius);
    box_blur_v(&temp, data, w, h, radius);
}

fn box_blur_h(src: &[u8], dst: &mut [u8], w: usize, h: usize, r: usize) {
    let r = r / 2;
    let iarr = 1.0 / (r + r + 1) as f32;

    for y in 0..h {
        let row = y * w * 4;

        let mut val_r = src[row] as f32 * (r + 1) as f32;
        let mut val_g = src[row + 1] as f32 * (r + 1) as f32;
        let mut val_b = src[row + 2] as f32 * (r + 1) as f32;
        let mut val_a = src[row + 3] as f32 * (r + 1) as f32;

        for i in 0..r {
            let idx = row + (i.min(w - 1)) * 4;
            val_r += src[idx] as f32;
            val_g += src[idx + 1] as f32;
            val_b += src[idx + 2] as f32;
            val_a += src[idx + 3] as f32;
        }

        for x in 0..w {
            let right = row + ((x + r).min(w - 1)) * 4;
            let left = row + (x.saturating_sub(r + 1)) * 4;

            val_r += src[right] as f32 - src[left] as f32;
            val_g += src[right + 1] as f32 - src[left + 1] as f32;
            val_b += src[right + 2] as f32 - src[left + 2] as f32;
            val_a += src[right + 3] as f32 - src[left + 3] as f32;

            let idx = row + x * 4;
            dst[idx] = (val_r * iarr).round().clamp(0.0, 255.0) as u8;
            dst[idx + 1] = (val_g * iarr).round().clamp(0.0, 255.0) as u8;
            dst[idx + 2] = (val_b * iarr).round().clamp(0.0, 255.0) as u8;
            dst[idx + 3] = (val_a * iarr).round().clamp(0.0, 255.0) as u8;
        }
    }
}

fn box_blur_v(src: &[u8], dst: &mut [u8], w: usize, h: usize, r: usize) {
    let r = r / 2;
    let iarr = 1.0 / (r + r + 1) as f32;

    for x in 0..w {
        let col = x * 4;

        let mut val_r = src[col] as f32 * (r + 1) as f32;
        let mut val_g = src[col + 1] as f32 * (r + 1) as f32;
        let mut val_b = src[col + 2] as f32 * (r + 1) as f32;
        let mut val_a = src[col + 3] as f32 * (r + 1) as f32;

        for i in 0..r {
            let idx = (i.min(h - 1)) * w * 4 + col;
            val_r += src[idx] as f32;
            val_g += src[idx + 1] as f32;
            val_b += src[idx + 2] as f32;
            val_a += src[idx + 3] as f32;
        }

        for y in 0..h {
            let below = ((y + r).min(h - 1)) * w * 4 + col;
            let above = y.saturating_sub(r + 1) * w * 4 + col;

            val_r += src[below] as f32 - src[above] as f32;
            val_g += src[below + 1] as f32 - src[above + 1] as f32;
            val_b += src[below + 2] as f32 - src[above + 2] as f32;
            val_a += src[below + 3] as f32 - src[above + 3] as f32;

            let idx = y * w * 4 + col;
            dst[idx] = (val_r * iarr).round().clamp(0.0, 255.0) as u8;
            dst[idx + 1] = (val_g * iarr).round().clamp(0.0, 255.0) as u8;
            dst[idx + 2] = (val_b * iarr).round().clamp(0.0, 255.0) as u8;
            dst[idx + 3] = (val_a * iarr).round().clamp(0.0, 255.0) as u8;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_blur_no_panic() {
        let mut data = vec![128u8; 4 * 10 * 10];
        gaussian_blur(&mut data, 10, 10, 2.0);
        assert!(data.iter().all(|&v| v > 0));
    }

    #[test]
    fn test_blur_zero_radius() {
        let original = vec![100u8; 4 * 5 * 5];
        let mut data = original.clone();
        gaussian_blur(&mut data, 5, 5, 0.0);
        assert_eq!(data, original);
    }
}
