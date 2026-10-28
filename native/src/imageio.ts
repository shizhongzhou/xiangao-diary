/**
 * 图片读写：用 Skia 解码、缩放、读出像素，再把像素变回图片/PNG。
 */
import { AlphaType, ColorType, ImageFormat, Skia, type SkImage } from '@shopify/react-native-skia';
import { File } from 'expo-file-system';

export interface Pixels {
  w: number;
  h: number;
  rgba: Uint8Array;
}

const RGBA = { colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul };

// 不同版本的 Skia 有的接收 SkData、有的直接接收 Uint8Array，两种都试一下
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ImageFactory = Skia.Image as any;

function decode(bytes: Uint8Array): SkImage | null {
  try {
    const img = ImageFactory.MakeImageFromEncoded(Skia.Data.fromBytes(bytes));
    if (img) return img;
  } catch {
    // 换另一种写法
  }
  try {
    return ImageFactory.MakeImageFromEncoded(bytes) ?? null;
  } catch {
    return null;
  }
}

/** 读取一张图片文件，缩放到最长边不超过 maxSide，返回 RGBA 像素。 */
export async function loadPixels(uri: string, maxSide: number): Promise<Pixels> {
  const bytes = await new File(uri).bytes();
  const img = decode(bytes);
  if (!img) throw new Error('无法读取这张图片');
  const sw = img.width();
  const sh = img.height();
  const s = Math.min(1, maxSide / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * s));
  const h = Math.max(1, Math.round(sh * s));

  const surface = Skia.Surface.Make(w, h);
  if (!surface) throw new Error('无法创建画布');
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('white'));
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  canvas.drawImageRect(img, Skia.XYWHRect(0, 0, sw, sh), Skia.XYWHRect(0, 0, w, h), paint);
  surface.flush();
  const snap = surface.makeImageSnapshot();
  const px = snap.readPixels(0, 0, { width: w, height: h, ...RGBA });
  if (!px) throw new Error('无法读取像素');
  const rgba = px instanceof Uint8Array ? px : Uint8Array.from(px as Float32Array, (v: number) => Math.round(v * 255));
  return { w, h, rgba };
}

/** RGBA 像素 → Skia 图片（用于显示） */
export function makeImage(rgba: Uint8Array, w: number, h: number): SkImage | null {
  const info = { width: w, height: h, ...RGBA };
  try {
    const img = ImageFactory.MakeImage(info, Skia.Data.fromBytes(rgba), w * 4);
    if (img) return img;
  } catch {
    // 换另一种写法
  }
  try {
    return ImageFactory.MakeImage(info, rgba, w * 4) ?? null;
  } catch {
    return null;
  }
}

/** RGBA 像素 → PNG 字节 */
export function encodePng(rgba: Uint8Array, w: number, h: number): Uint8Array {
  const img = makeImage(rgba, w, h);
  if (!img) throw new Error('无法生成图片');
  return img.encodeToBytes(ImageFormat.PNG, 100);
}

/** 线稿遮罩 → 黑线白底的 RGBA */
export function maskToRgba(ink: Uint8Array): Uint8Array {
  const out = new Uint8Array(ink.length * 4);
  for (let i = 0, j = 0; i < ink.length; i++, j += 4) {
    const v = ink[i] ? 26 : 255;
    out[j] = v; out[j + 1] = v; out[j + 2] = v; out[j + 3] = 255;
  }
  return out;
}

/** 黑线白底的 PNG → 线稿遮罩 */
export async function loadMask(uri: string): Promise<{ w: number; h: number; ink: Uint8Array }> {
  const { w, h, rgba } = await loadPixels(uri, 100000);
  const ink = new Uint8Array(w * h);
  for (let i = 0; i < ink.length; i++) ink[i] = rgba[i * 4] < 128 ? 1 : 0;
  return { w, h, ink };
}

/** 让出一帧，好让“处理中”的提示先显示出来，再开始耗时计算。 */
export function nextFrame(): Promise<void> {
  return new Promise((r) => setTimeout(r, 60));
}
