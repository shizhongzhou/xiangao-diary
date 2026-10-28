/**
 * 照片 → 线稿，以及线稿 → 可填色区域。
 * 纯 TypeScript，不依赖任何原生模块，所有运算都在手机本地完成。
 */

export type StyleId = 'thin' | 'bold' | 'comic';

export const STYLE_LIST: { id: StyleId; label: string }[] = [
  { id: 'thin', label: '细线' },
  { id: 'bold', label: '粗线' },
  { id: 'comic', label: '漫画' },
];

interface StyleParams {
  colors: number; // 色块数量：越多格子越多
  colorSigma: number; // 归并色块前的模糊程度：越大格子越圆润
  sigma: number; // 细节线的预模糊
  highPct: number; // 细节线的强度阈值（分位数）：越大细节线越少
  thickness: number; // 线条加粗半径（像素）
  darkFill: boolean; // 漫画风：把最暗的区域涂成实心黑
}

const PARAMS: Record<StyleId, StyleParams> = {
  thin: { colors: 8, colorSigma: 2.2, sigma: 1.4, highPct: 0.86, thickness: 1, darkFill: false },
  bold: { colors: 6, colorSigma: 3.0, sigma: 2.0, highPct: 0.92, thickness: 2, darkFill: false },
  comic: { colors: 5, colorSigma: 3.4, sigma: 2.2, highPct: 0.94, thickness: 2, darkFill: true },
};

/** 处理时图片的最长边。越大越清晰，但越慢。 */
export const WORK_SIZE = 800;

// ---------- 基础工具 ----------

function toGray(rgba: Uint8Array, n: number): Float32Array {
  const g = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    g[i] = 0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2];
  }
  return g;
}

function gaussianBlur(src: Float32Array, w: number, h: number, sigma: number): Float32Array {
  const r = Math.max(1, Math.ceil(sigma * 2.5));
  const k = new Float32Array(2 * r + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k[i + r] = v;
    sum += v;
  }
  for (let i = 0; i < k.length; i++) k[i] /= sum;

  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let i = -r; i <= r; i++) {
        let xx = x + i;
        if (xx < 0) xx = 0;
        else if (xx >= w) xx = w - 1;
        acc += src[row + xx] * k[i + r];
      }
      tmp[row + x] = acc;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let i = -r; i <= r; i++) {
        let yy = y + i;
        if (yy < 0) yy = 0;
        else if (yy >= h) yy = h - 1;
        acc += tmp[yy * w + x] * k[i + r];
      }
      out[y * w + x] = acc;
    }
  }
  return out;
}

/** 正方形 + 十字交替膨胀，近似圆形笔刷。 */
export function dilate(mask: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  let cur = mask;
  for (let it = 0; it < radius; it++) {
    const square = it % 2 === 0;
    const next = new Uint8Array(cur);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (cur[i]) continue;
        const l = x > 0 && cur[i - 1];
        const rr = x < w - 1 && cur[i + 1];
        const u = y > 0 && cur[i - w];
        const d = y < h - 1 && cur[i + w];
        let hit = l || rr || u || d;
        if (!hit && square) {
          hit =
            (x > 0 && y > 0 && cur[i - w - 1]) ||
            (x < w - 1 && y > 0 && cur[i - w + 1]) ||
            (x > 0 && y < h - 1 && cur[i + w - 1]) ||
            (x < w - 1 && y < h - 1 && cur[i + w + 1]);
        }
        if (hit) next[i] = 1;
      }
    }
    cur = next;
  }
  return cur;
}

/** 给 value===target 的像素做 4 连通标记，返回标签和每块大小。 */
function components(
  mask: Uint8Array,
  w: number,
  h: number,
  target: number,
  eight: boolean,
): { labels: Int32Array; sizes: number[] } {
  const n = w * h;
  const labels = new Int32Array(n).fill(-1);
  const sizes: number[] = [];
  const stack = new Int32Array(n);
  let next = 0;
  for (let s = 0; s < n; s++) {
    if (mask[s] !== target || labels[s] !== -1) continue;
    const id = next++;
    let sp = 0;
    stack[sp++] = s;
    labels[s] = id;
    let count = 0;
    while (sp > 0) {
      const i = stack[--sp];
      count++;
      const x = i % w;
      const y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (!eight && dx !== 0 && dy !== 0) continue;
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const j = yy * w + xx;
          if (mask[j] === target && labels[j] === -1) {
            labels[j] = id;
            stack[sp++] = j;
          }
        }
      }
    }
    sizes.push(count);
  }
  return { labels, sizes };
}

function percentile(values: Float32Array, count: number, p: number): number {
  // 直方图近似，避免对几十万个数排序
  let max = 0;
  for (let i = 0; i < count; i++) if (values[i] > max) max = values[i];
  if (max === 0) return 0;
  const bins = 1024;
  const hist = new Uint32Array(bins);
  for (let i = 0; i < count; i++) hist[Math.min(bins - 1, Math.floor((values[i] / max) * bins))]++;
  const target = p * count;
  let acc = 0;
  for (let b = 0; b < bins; b++) {
    acc += hist[b];
    if (acc >= target) return ((b + 0.5) / bins) * max;
  }
  return max;
}

// ---------- 色块归并（保证边界封闭） ----------

/** 把模糊后的照片归并成 k 种颜色，返回每个像素的色块编号。 */
function posterize(rgba: Uint8Array, w: number, h: number, k: number, sigma: number): Uint8Array {
  const n = w * h;
  const ch: Float32Array[] = [0, 1, 2].map((c) => {
    const a = new Float32Array(n);
    for (let i = 0; i < n; i++) a[i] = rgba[i * 4 + c];
    return gaussianBlur(a, w, h, sigma);
  });
  const [R, G, B] = ch;

  // k-means（在抽样像素上训练）
  const step = Math.max(1, Math.floor(n / 20000));
  const sample: number[] = [];
  for (let i = 0; i < n; i += step) sample.push(i);
  sample.sort((a, b) => R[a] + G[a] + B[a] - (R[b] + G[b] + B[b]));
  const cr = new Float32Array(k), cg = new Float32Array(k), cb = new Float32Array(k);
  for (let c = 0; c < k; c++) {
    const s = sample[Math.floor(((c + 0.5) / k) * sample.length)];
    cr[c] = R[s]; cg[c] = G[s]; cb[c] = B[s];
  }
  const nearest = (i: number) => {
    let best = 0, bd = Infinity;
    for (let c = 0; c < k; c++) {
      const dr = R[i] - cr[c], dg = G[i] - cg[c], db = B[i] - cb[c];
      const d = dr * dr * 0.9 + dg * dg * 1.2 + db * db * 0.7;
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  };
  for (let it = 0; it < 10; it++) {
    const sr = new Float64Array(k), sg = new Float64Array(k), sb = new Float64Array(k), cnt = new Float64Array(k);
    for (const i of sample) {
      const c = nearest(i);
      sr[c] += R[i]; sg[c] += G[i]; sb[c] += B[i]; cnt[c]++;
    }
    for (let c = 0; c < k; c++) if (cnt[c]) { cr[c] = sr[c] / cnt[c]; cg[c] = sg[c] / cnt[c]; cb[c] = sb[c] / cnt[c]; }
  }
  let lab = new Uint8Array(n);
  for (let i = 0; i < n; i++) lab[i] = nearest(i);

  // 众数滤波，抹掉毛刺
  for (let pass = 0; pass < 3; pass++) {
    const next = new Uint8Array(lab);
    const votes = new Uint8Array(k);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        votes.fill(0);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) votes[lab[(y + dy) * w + x + dx]]++;
        let best = lab[y * w + x], bv = votes[best];
        for (let c = 0; c < k; c++) if (votes[c] > bv) { bv = votes[c]; best = c; }
        next[y * w + x] = best;
      }
    }
    lab = next;
  }
  return lab;
}

/** 太小的色块并入相邻色块，返回连通块编号（每个编号就是一个封闭格子）。 */
function cleanSegments(lab: Uint8Array, w: number, h: number, minArea: number): Int32Array {
  const n = w * h;
  const seg = new Int32Array(n).fill(-1);
  const sizes: number[] = [];
  const stack = new Int32Array(n);
  let next = 0;
  for (let s = 0; s < n; s++) {
    if (seg[s] !== -1) continue;
    const id = next++;
    const v = lab[s];
    let sp = 0, count = 0;
    stack[sp++] = s; seg[s] = id;
    while (sp > 0) {
      const i = stack[--sp];
      count++;
      const x = i % w;
      if (x > 0 && seg[i - 1] === -1 && lab[i - 1] === v) { seg[i - 1] = id; stack[sp++] = i - 1; }
      if (x < w - 1 && seg[i + 1] === -1 && lab[i + 1] === v) { seg[i + 1] = id; stack[sp++] = i + 1; }
      if (i >= w && seg[i - w] === -1 && lab[i - w] === v) { seg[i - w] = id; stack[sp++] = i - w; }
      if (i + w < n && seg[i + w] === -1 && lab[i + w] === v) { seg[i + w] = id; stack[sp++] = i + w; }
    }
    sizes.push(count);
  }
  // 小块的像素标为 -1，再从大块一圈圈“长”进去
  const queue = new Int32Array(n);
  let qh = 0, qt = 0;
  for (let i = 0; i < n; i++) {
    if (sizes[seg[i]] < minArea) seg[i] = -1;
  }
  for (let i = 0; i < n; i++) {
    if (seg[i] === -1) continue;
    const x = i % w;
    if ((x > 0 && seg[i - 1] === -1) || (x < w - 1 && seg[i + 1] === -1) ||
        (i >= w && seg[i - w] === -1) || (i + w < n && seg[i + w] === -1)) queue[qt++] = i;
  }
  while (qh < qt) {
    const i = queue[qh++];
    const x = i % w;
    const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i + w < n ? i + w : -1];
    for (const j of nb) {
      if (j >= 0 && seg[j] === -1) { seg[j] = seg[i]; queue[qt++] = j; }
    }
  }
  for (let i = 0; i < n; i++) if (seg[i] === -1) seg[i] = 0; // 整张图都是小块的极端情况
  return seg;
}

// ---------- 照片 → 线稿 ----------

/**
 * 输入 RGBA 像素，输出线稿遮罩（1 = 黑线，0 = 空白）。
 * 流程：灰度 → 高斯模糊 → Canny 边缘（Sobel + 非极大值抑制 + 双阈值）
 *      → 去掉碎线 → 加粗 → （漫画风）暗部涂黑 → 把太小的空白碎块并入线条。
 */
export function makeLineArt(rgba: Uint8Array, w: number, h: number, style: StyleId): Uint8Array {
  const P = PARAMS[style];
  const n = w * h;
  const smooth = gaussianBlur(toGray(rgba, n), w, h, P.sigma);

  // Sobel
  const mag = new Float32Array(n);
  const dir = new Uint8Array(n); // 0: 横, 1: 45°, 2: 竖, 3: 135°
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const a = smooth[i - w - 1], b = smooth[i - w], c = smooth[i - w + 1];
      const d = smooth[i - 1], f = smooth[i + 1];
      const g = smooth[i + w - 1], hh = smooth[i + w], k = smooth[i + w + 1];
      const gx = c + 2 * f + k - (a + 2 * d + g);
      const gy = g + 2 * hh + k - (a + 2 * b + c);
      mag[i] = Math.sqrt(gx * gx + gy * gy);
      let ang = (Math.atan2(gy, gx) * 180) / Math.PI;
      if (ang < 0) ang += 180;
      dir[i] = ang < 22.5 || ang >= 157.5 ? 0 : ang < 67.5 ? 1 : ang < 112.5 ? 2 : 3;
    }
  }

  // 非极大值抑制
  const nms = new Float32Array(n);
  const nz = new Float32Array(n);
  let nzCount = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const m = mag[i];
      if (m === 0) continue;
      let p: number, q: number;
      switch (dir[i]) {
        case 0: p = mag[i - 1]; q = mag[i + 1]; break;
        case 1: p = mag[i - w - 1]; q = mag[i + w + 1]; break;
        case 2: p = mag[i - w]; q = mag[i + w]; break;
        default: p = mag[i - w + 1]; q = mag[i + w - 1];
      }
      if (m >= p && m >= q) {
        nms[i] = m;
        nz[nzCount++] = m;
      }
    }
  }

  // 双阈值 + 连接
  const high = Math.max(8, percentile(nz, nzCount, P.highPct));
  const low = high * 0.45;
  const edge = new Uint8Array(n);
  const stack = new Int32Array(n);
  let sp = 0;
  for (let i = 0; i < n; i++) {
    if (nms[i] >= high) {
      edge[i] = 1;
      stack[sp++] = i;
    }
  }
  while (sp > 0) {
    const i = stack[--sp];
    const x = i % w;
    const y = (i - x) / w;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        if (!edge[j] && nms[j] >= low) {
          edge[j] = 1;
          stack[sp++] = j;
        }
      }
    }
  }

  // 去掉很短的碎线
  const minLen = Math.max(10, Math.round(Math.max(w, h) / 45));
  {
    const { labels, sizes } = components(edge, w, h, 1, true);
    for (let i = 0; i < n; i++) if (labels[i] >= 0 && sizes[labels[i]] < minLen) edge[i] = 0;
  }

  // 色块边界：天然封闭，保证每个格子都能填色
  const seg = cleanSegments(posterize(rgba, w, h, P.colors, P.colorSigma), w, h, Math.round(n * 0.0025));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if ((x < w - 1 && seg[i] !== seg[i + 1]) || (y < h - 1 && seg[i] !== seg[i + w])) edge[i] = 1;
    }
  }

  let ink = dilate(edge, w, h, P.thickness);

  // 漫画风：最暗的大块区域涂黑
  if (P.darkFill) {
    const darkT = Math.min(55, percentile(smooth, n, 0.06));
    const dark = new Uint8Array(n);
    for (let i = 0; i < n; i++) if (smooth[i] <= darkT) dark[i] = 1;
    const minDark = Math.round(n * 0.0008);
    const { labels, sizes } = components(dark, w, h, 1, false);
    for (let i = 0; i < n; i++) if (labels[i] >= 0 && sizes[labels[i]] >= minDark) ink[i] = 1;
  }

  // 把太小的空白碎块并入线条，涂色时不会出现点不中的小格子
  const minArea = Math.max(30, Math.round(n * 0.00012));
  {
    const { labels, sizes } = components(ink, w, h, 0, false);
    for (let i = 0; i < n; i++) if (labels[i] >= 0 && sizes[labels[i]] < minArea) ink[i] = 1;
  }

  // 边框留白一圈，避免贴边的黑线
  for (let x = 0; x < w; x++) { ink[x] = 0; ink[(h - 1) * w + x] = 0; }
  for (let y = 0; y < h; y++) { ink[y * w] = 0; ink[y * w + w - 1] = 0; }
  return ink;
}

// ---------- 线稿 → 填色区域 ----------

export interface Regions {
  labels: Int32Array; // 每个像素属于哪个区域，-1 = 黑线
  count: number;
  areas: Int32Array; // 每个区域的像素数
  total: number; // 所有可涂区域的像素总数
}

/**
 * 把线稿切成一个个可以点击填色的格子。
 * 先把线条再加粗 1 像素当“墙”，补上细小的缺口，避免颜色漏出去；
 * 然后把墙两侧多出来的那一圈像素分配回相邻的格子，填色时贴紧线条、没有白边。
 */
export function buildRegions(ink: Uint8Array, w: number, h: number): Regions {
  const n = w * h;
  const wall = dilate(ink, w, h, 1);
  const { labels, sizes } = components(wall, w, h, 0, false);

  // 多源 BFS：把墙上（但不是黑线）的像素分给最近的格子
  const queue = new Int32Array(n);
  let qh = 0, qt = 0;
  for (let i = 0; i < n; i++) if (labels[i] >= 0) queue[qt++] = i;
  while (qh < qt) {
    const i = queue[qh++];
    const lab = labels[i];
    const x = i % w;
    const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w];
    for (let k = 0; k < 4; k++) {
      const j = nb[k];
      if (j < 0 || j >= n) continue;
      if (labels[j] === -1 && wall[j] && !ink[j]) {
        labels[j] = lab;
        queue[qt++] = j;
      }
    }
  }

  const areas = new Int32Array(sizes.length);
  let total = 0;
  for (let i = 0; i < n; i++) {
    if (ink[i]) labels[i] = -1;
    const l = labels[i];
    if (l >= 0) { areas[l]++; total++; }
  }
  return { labels, count: sizes.length, areas, total };
}

/** 找到点击位置所在的格子；点在线上时找附近最近的格子。 */
export function regionAt(regions: Regions, w: number, h: number, x: number, y: number): number {
  const xi = Math.round(x), yi = Math.round(y);
  for (let r = 0; r <= 10; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const xx = xi + dx, yy = yi + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const l = regions.labels[yy * w + xx];
        if (l >= 0) return l;
      }
    }
  }
  return -1;
}

export const INK = [26, 26, 26];

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** 合成最终画面：线条 + 每个格子的颜色（没涂的为白色）。 */
export function compose(
  ink: Uint8Array,
  regions: Regions,
  colors: Record<number, string>,
  w: number,
  h: number,
): Uint8Array {
  const n = w * h;
  const lut = new Uint8Array(regions.count * 3).fill(255);
  for (const key of Object.keys(colors)) {
    const l = Number(key);
    if (l >= 0 && l < regions.count) {
      const [r, g, b] = hexToRgb(colors[l]);
      lut[l * 3] = r; lut[l * 3 + 1] = g; lut[l * 3 + 2] = b;
    }
  }
  const out = new Uint8Array(n * 4);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    if (ink[i]) {
      out[j] = INK[0]; out[j + 1] = INK[1]; out[j + 2] = INK[2];
    } else {
      const l = regions.labels[i];
      out[j] = lut[l * 3]; out[j + 1] = lut[l * 3 + 1]; out[j + 2] = lut[l * 3 + 2];
    }
    out[j + 3] = 255;
  }
  return out;
}

/** 已涂面积占比 0~1 */
export function coloredRatio(regions: Regions, colors: Record<number, string>): number {
  if (!regions.total) return 0;
  let a = 0;
  for (const key of Object.keys(colors)) {
    const l = Number(key);
    if (l >= 0 && l < regions.count) a += regions.areas[l];
  }
  return a / regions.total;
}
