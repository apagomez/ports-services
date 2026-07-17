export const oklchToRgb = (str: string): string => {
  if (!str) return '';
  let result = str.replace(/oklch\(\s*([\d.]+)(%?)\s+([\d.]+)(%?)\s+([\d.]+)(deg|rad)?(?:\s*\/\s*([\d.e-]+)(%?))?\s*\)/gi, (match, lVal, lPercent, cVal, cPercent, hVal, hUnit, aVal, aPercent) => {
    let L = parseFloat(lVal);
    if (lPercent === '%') L /= 100;
    let C = parseFloat(cVal);
    if (cPercent === '%') C /= 100;
    let H = parseFloat(hVal);
    if (hUnit === 'rad') H = H * 180 / Math.PI;
    let alpha = 1;
    if (aVal !== undefined) {
      alpha = parseFloat(aVal);
      if (aPercent === '%') alpha /= 100;
    }
    const H_rad = H * Math.PI / 180;
    const a = C * Math.cos(H_rad);
    const b = C * Math.sin(H_rad);
    const L_lms = L + 0.3963377774 * a + 0.2158037573 * b;
    const M_lms = L - 0.1055613458 * a - 0.0638541728 * b;
    const S_lms = L - 0.0894841775 * a - 1.2914855480 * b;
    const l = Math.pow(Math.max(0, L_lms), 3);
    const m = Math.pow(Math.max(0, M_lms), 3);
    const s = Math.pow(Math.max(0, S_lms), 3);
    let r_val = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    let g_val = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    let b_rgb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
    const transform = (x: number) => x > 0.0031308 ? 1.055 * Math.pow(x, 1 / 2.4) - 0.055 : 12.92 * x;
    let R_val = Math.max(0, Math.min(255, Math.round(transform(r_val) * 255)));
    let G_val = Math.max(0, Math.min(255, Math.round(transform(g_val) * 255)));
    let B_val = Math.max(0, Math.min(255, Math.round(transform(b_rgb) * 255)));
    return alpha === 1 ? `rgb(${R_val},${G_val},${B_val})` : `rgba(${R_val},${G_val},${B_val},${alpha})`;
  });

  result = result.replace(/oklab\(\s*([\d.]+)(%?)\s+([\d.-]+)(%?)\s+([\d.-]+)(%?)(?:\s*\/\s*([\d.]+)(%?))?\s*\)/gi, (match, lVal, lPercent, aVal, aPercent, bVal, bPercent, aVal2, aPercent2) => {
    let L = parseFloat(lVal);
    if (lPercent === '%') L /= 100;
    let aValNum = parseFloat(aVal);
    if (aPercent === '%') aValNum /= 100;
    let bValNum = parseFloat(bVal);
    if (bPercent === '%') bValNum /= 100;
    let alpha = 1;
    if (aVal2 !== undefined) {
      alpha = parseFloat(aVal2);
      if (aPercent2 === '%') alpha /= 100;
    }
    const L_lms = L + 0.3963377774 * aValNum + 0.2158037573 * bValNum;
    const M_lms = L - 0.1055613458 * aValNum - 0.0638541728 * bValNum;
    const S_lms = L - 0.0894841775 * aValNum - 1.2914855480 * bValNum;
    const l = Math.pow(Math.max(0, L_lms), 3);
    const m = Math.pow(Math.max(0, M_lms), 3);
    const s = Math.pow(Math.max(0, S_lms), 3);
    let r_val = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    let g_val = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    let b_rgb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
    const transform = (x: number) => x > 0.0031308 ? 1.055 * Math.pow(x, 1 / 2.4) - 0.055 : 12.92 * x;
    let R_val = Math.max(0, Math.min(255, Math.round(transform(r_val) * 255)));
    let G_val = Math.max(0, Math.min(255, Math.round(transform(g_val) * 255)));
    let B_val = Math.max(0, Math.min(255, Math.round(transform(b_rgb) * 255)));
    return alpha === 1 ? `rgb(${R_val},${G_val},${B_val})` : `rgba(${R_val},${G_val},${B_val},${alpha})`;
  });

  return result;
};
