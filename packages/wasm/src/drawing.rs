use wasm_bindgen::prelude::*;

/// Parse ASS drawing commands and rasterize to RGBA pixel data.
/// Returns a Vec<u8> of width*height*4 RGBA bytes.
///
/// Drawing commands: m (move), l (line), b (bezier), s (spline), c (close)
#[wasm_bindgen]
pub fn rasterize_drawing(
    commands: &str,
    scale: u32,
    width: u32,
    height: u32,
    color_r: u8,
    color_g: u8,
    color_b: u8,
    color_a: u8,
) -> Vec<u8> {
    let w = width as usize;
    let h = height as usize;
    let mut pixels = vec![0u8; w * h * 4];

    if w == 0 || h == 0 || commands.is_empty() {
        return pixels;
    }

    let s = 1.0 / (1u32 << (scale.saturating_sub(1))) as f64;
    let edges = parse_to_edges(commands, s);

    // Scanline fill
    for y in 0..h {
        let scan_y = y as f64 + 0.5;
        let mut intersections: Vec<f64> = Vec::new();

        for edge in &edges {
            if (edge.y_min <= scan_y && edge.y_max > scan_y)
                || (edge.y_max <= scan_y && edge.y_min > scan_y)
            {
                if (edge.y_max - edge.y_min).abs() < 1e-10 {
                    continue;
                }
                let t = (scan_y - edge.y_min) / (edge.y_max - edge.y_min);
                let x = edge.x_min + t * (edge.x_max - edge.x_min);
                intersections.push(x);
            }
        }

        intersections.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

        for pair in intersections.chunks(2) {
            if pair.len() < 2 {
                break;
            }
            let x_start = (pair[0].max(0.0) as usize).min(w);
            let x_end = (pair[1].ceil().max(0.0) as usize).min(w);

            for x in x_start..x_end {
                let idx = (y * w + x) * 4;
                pixels[idx] = color_r;
                pixels[idx + 1] = color_g;
                pixels[idx + 2] = color_b;
                pixels[idx + 3] = color_a;
            }
        }
    }

    pixels
}

struct Edge {
    x_min: f64,
    y_min: f64,
    x_max: f64,
    y_max: f64,
}

fn parse_to_edges(commands: &str, scale: f64) -> Vec<Edge> {
    let mut edges = Vec::new();
    let tokens: Vec<&str> = commands.split_whitespace().collect();
    let mut i = 0;
    let mut cx = 0.0f64;
    let mut cy = 0.0f64;
    let mut start_x = 0.0f64;
    let mut start_y = 0.0f64;

    while i < tokens.len() {
        match tokens[i] {
            "m" | "n" => {
                if i + 2 < tokens.len() {
                    cx = parse_f64(tokens[i + 1]) * scale;
                    cy = parse_f64(tokens[i + 2]) * scale;
                    start_x = cx;
                    start_y = cy;
                    i += 3;
                } else {
                    i += 1;
                }
            }
            "l" => {
                i += 1;
                while i + 1 < tokens.len() {
                    if let Ok(_) = tokens[i].parse::<f64>() {
                        let nx = parse_f64(tokens[i]) * scale;
                        let ny = parse_f64(tokens[i + 1]) * scale;
                        edges.push(Edge { x_min: cx, y_min: cy, x_max: nx, y_max: ny });
                        cx = nx;
                        cy = ny;
                        i += 2;
                    } else {
                        break;
                    }
                }
            }
            "b" => {
                i += 1;
                while i + 5 < tokens.len() {
                    if let Ok(_) = tokens[i].parse::<f64>() {
                        let x1 = parse_f64(tokens[i]) * scale;
                        let y1 = parse_f64(tokens[i + 1]) * scale;
                        let x2 = parse_f64(tokens[i + 2]) * scale;
                        let y2 = parse_f64(tokens[i + 3]) * scale;
                        let x3 = parse_f64(tokens[i + 4]) * scale;
                        let y3 = parse_f64(tokens[i + 5]) * scale;

                        flatten_bezier(&mut edges, cx, cy, x1, y1, x2, y2, x3, y3, 0);
                        cx = x3;
                        cy = y3;
                        i += 6;
                    } else {
                        break;
                    }
                }
            }
            "c" => {
                if (cx - start_x).abs() > 1e-10 || (cy - start_y).abs() > 1e-10 {
                    edges.push(Edge {
                        x_min: cx, y_min: cy, x_max: start_x, y_max: start_y,
                    });
                }
                cx = start_x;
                cy = start_y;
                i += 1;
            }
            _ => {
                if let Ok(nx) = tokens[i].parse::<f64>() {
                    if i + 1 < tokens.len() {
                        let ny = parse_f64(tokens[i + 1]) * scale;
                        let nx = nx * scale;
                        edges.push(Edge { x_min: cx, y_min: cy, x_max: nx, y_max: ny });
                        cx = nx;
                        cy = ny;
                        i += 2;
                    } else {
                        i += 1;
                    }
                } else {
                    i += 1;
                }
            }
        }
    }

    // Auto-close
    if (cx - start_x).abs() > 1e-10 || (cy - start_y).abs() > 1e-10 {
        edges.push(Edge {
            x_min: cx, y_min: cy, x_max: start_x, y_max: start_y,
        });
    }

    edges
}

fn flatten_bezier(
    edges: &mut Vec<Edge>,
    x0: f64, y0: f64,
    x1: f64, y1: f64,
    x2: f64, y2: f64,
    x3: f64, y3: f64,
    depth: u32,
) {
    if depth > 8 {
        edges.push(Edge { x_min: x0, y_min: y0, x_max: x3, y_max: y3 });
        return;
    }

    let flatness = (x0 + x3 - 2.0 * x1).powi(2)
        + (y0 + y3 - 2.0 * y1).powi(2)
        + (x0 + x3 - 2.0 * x2).powi(2)
        + (y0 + y3 - 2.0 * y2).powi(2);

    if flatness < 1.0 {
        edges.push(Edge { x_min: x0, y_min: y0, x_max: x3, y_max: y3 });
        return;
    }

    let mx01 = (x0 + x1) / 2.0;
    let my01 = (y0 + y1) / 2.0;
    let mx12 = (x1 + x2) / 2.0;
    let my12 = (y1 + y2) / 2.0;
    let mx23 = (x2 + x3) / 2.0;
    let my23 = (y2 + y3) / 2.0;
    let mx012 = (mx01 + mx12) / 2.0;
    let my012 = (my01 + my12) / 2.0;
    let mx123 = (mx12 + mx23) / 2.0;
    let my123 = (my12 + my23) / 2.0;
    let mx0123 = (mx012 + mx123) / 2.0;
    let my0123 = (my012 + my123) / 2.0;

    flatten_bezier(edges, x0, y0, mx01, my01, mx012, my012, mx0123, my0123, depth + 1);
    flatten_bezier(edges, mx0123, my0123, mx123, my123, mx23, my23, x3, y3, depth + 1);
}

fn parse_f64(s: &str) -> f64 {
    s.parse::<f64>().unwrap_or(0.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_drawing() {
        let result = rasterize_drawing("m 0 0 l 10 0 l 10 10 l 0 10", 1, 12, 12, 255, 0, 0, 255);
        assert_eq!(result.len(), 12 * 12 * 4);
        // Check that some pixels are filled
        let filled: usize = result.chunks(4).filter(|p| p[3] > 0).count();
        assert!(filled > 0);
    }

    #[test]
    fn test_empty_drawing() {
        let result = rasterize_drawing("", 1, 10, 10, 255, 255, 255, 255);
        assert!(result.iter().all(|&v| v == 0));
    }
}
