/**
 * 生成 PWA / 主屏图标（零依赖，纯 Node）。
 * 设计与顶栏 logo 一致：主色渐变圆角方块 + 白色菱形 + 中心圆点。
 * 修改主色后可重新执行：node scripts/generate-icons.mjs
 */
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const ICONS = [
  { file: 'public/icon-192.png', size: 192 },
  { file: 'public/icon-512.png', size: 512 },
  { file: 'public/apple-touch-icon.png', size: 180 },
]
/** 渐变两端：--accent → --accent-2 */
const FROM = [0x4f, 0x7c, 0xff]
const TO = [0x9b, 0x5c, 0xff]
/** 菱形下半部的压暗比例（与 logo 的第二段一致） */
const SHADE = 0.28
const SHADE_RGB = [16, 32, 88]

const crcTable = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeAndData = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData))
  return Buffer.concat([len, typeAndData, crc])
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // 位深
  ihdr[9] = 6 // 颜色类型 RGBA
  const raw = Buffer.alloc(height * (width * 4 + 1))
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0 // 过滤器：None
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** 单个像素颜色（含透明度），坐标已归一化到 0..1 */
function pixelAt(u, v) {
  const radius = 0.22
  const dx = Math.abs(u - 0.5)
  const dy = Math.abs(v - 0.5)
  // 圆角方块：四角做圆弧裁切
  const cx = Math.max(dx - (0.5 - radius), 0)
  const cy = Math.max(dy - (0.5 - radius), 0)
  if (Math.sqrt(cx * cx + cy * cy) > radius) return [0, 0, 0, 0]

  const t = (u + v) / 2
  let r = FROM[0] + (TO[0] - FROM[0]) * t
  let g = FROM[1] + (TO[1] - FROM[1]) * t
  let b = FROM[2] + (TO[2] - FROM[2]) * t

  // 白色菱形（L1 距离），下半部按 SHADE 压暗
  const px = u - 0.5
  const py = v - 0.5
  const half = 0.27
  if (Math.abs(px) + Math.abs(py) <= half) {
    const shade = py > 0 ? SHADE : 0
    r = 255 * (1 - shade) + SHADE_RGB[0] * shade
    g = 255 * (1 - shade) + SHADE_RGB[1] * shade
    b = 255 * (1 - shade) + SHADE_RGB[2] * shade
  }
  // 中心圆点
  if (Math.hypot(px, py) <= 0.045) return [255, 255, 255, 255]

  return [r, g, b, 255]
}

/** 2×2 超采样后写出文件 */
function render(size) {
  const rgba = Buffer.alloc(size * size * 4)
  const ss = 2
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < ss; sy += 1) {
        for (let sx = 0; sx < ss; sx += 1) {
          const u = (x + (sx + 0.5) / ss) / size
          const v = (y + (sy + 0.5) / ss) / size
          const [pr, pg, pb, pa] = pixelAt(u, v)
          const w = pa / 255
          r += pr * w
          g += pg * w
          b += pb * w
          a += pa
        }
      }
      const n = ss * ss
      const alpha = a / n
      const wsum = a / 255 || 1
      const offset = (y * size + x) * 4
      rgba[offset] = Math.round(r / wsum)
      rgba[offset + 1] = Math.round(g / wsum)
      rgba[offset + 2] = Math.round(b / wsum)
      rgba[offset + 3] = Math.round(alpha)
    }
  }
  return encodePng(size, size, rgba)
}

for (const { file, size } of ICONS) {
  const png = render(size)
  writeFileSync(file, png)
  console.log(`${file}  ${size}×${size}  ${(png.length / 1024).toFixed(1)} kB`)
}
