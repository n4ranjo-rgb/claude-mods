// El destello de Claude, dibujado a mano: rayos afilados de longitudes
// irregulares alrededor de un núcleo. En la terminal se pinta en un Raster con
// medios bloques (dos píxeles cuadrados por celda) y se anima con $.ui.blit;
// en desktop / vscode / móvil es un SVG con animación SMIL.

export type Mood = 'idle' | 'working' | 'burst'

const RAYS = [1, 0.8, 0.95, 0.76, 1, 0.86, 0.93, 0.79, 0.98, 0.83, 0.9, 0.77] as const
const CORAL = [0xd9, 0x77, 0x57] as const
const LIGHT = [0xff, 0xd2, 0xb8] as const
const DEEP = [0xb5, 0x55, 0x38] as const
const DEFAULT = 0x01000000
const CORAL_HEX = 0xd97757
const HALF_TOP = 0x2580 // ▀
const HALF_BOTTOM = 0x2584 // ▄

type Rgb = readonly [number, number, number]

function mix(a: Rgb, b: Rgb, t: number): number {
  const k = Math.max(0, Math.min(1, t))
  const r = Math.round(a[0] + (b[0] - a[0]) * k)
  const g = Math.round(a[1] + (b[1] - a[1]) * k)
  const bl = Math.round(a[2] + (b[2] - a[2]) * k)
  return (r << 16) | (g << 8) | bl
}

function angleGap(a: number, b: number): number {
  const d = Math.abs(a - b) % (Math.PI * 2)
  return d > Math.PI ? Math.PI * 2 - d : d
}

export type Animator = {
  frame: (columns: number, rows: number) => string
  setMood: (mood: Mood) => void
  mood: () => Mood
}

export function animator(): Animator {
  let t = 0
  let rot = 0
  let shimmer = 0
  let mood: Mood = 'idle'
  let burstLeft = 0

  return {
    setMood(next) {
      if (next === 'burst') {
        burstLeft = 22
        return
      }
      mood = next
    },
    mood: () => (burstLeft > 0 ? 'burst' : mood),
    frame(columns, rows) {
      t += 1
      const isWorking = mood === 'working'
      rot += isWorking ? 0.085 : 0.014
      shimmer += isWorking ? 0.22 : 0.06
      const burst = burstLeft > 0 ? Math.sin((burstLeft / 22) * Math.PI) : 0
      if (burstLeft > 0) burstLeft -= 1

      const w = columns
      const h = rows * 2
      const cx = (w - 1) / 2
      const cy = (h - 1) / 2
      const radius = Math.min(w, h) / 2 - 2.2
      const breathe = 1 + 0.06 * Math.sin(t * 0.08) + 0.3 * burst
      const px = new Uint32Array(w * h) // 0 = vacío, si no color + 1

      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          const dx = x - cx
          const dy = y - cy
          const r = Math.hypot(dx, dy)
          const theta = Math.atan2(dy, dx)
          let lit = r <= 1.3 ? 1 : 0
          let tipness = 0

          for (let i = 0; i < RAYS.length && lit === 0; i += 1) {
            const pulse = isWorking ? 1 + 0.16 * Math.sin(t * 0.35 - i * 0.9) : 1
            const len = radius * (RAYS[i] ?? 1) * breathe * pulse
            const angle = rot + (i / RAYS.length) * Math.PI * 2
            const gap = angleGap(theta, angle)
            if (gap > Math.PI / 2 || r > len) continue
            const along = r * Math.cos(gap)
            const across = r * Math.sin(gap)
            const halfWidth = 1.75 * Math.pow(Math.max(0, 1 - along / len), 1.1) + 0.3
            if (across <= halfWidth) {
              lit = 1
              tipness = along / len
            }
          }

          if (lit === 1) {
            const glint = Math.exp(-Math.pow(angleGap(theta, shimmer), 2) / 0.18)
            const flash = Math.max(glint * 0.85, burst)
            const base = tipness > 0.82 ? mix(CORAL, DEEP, (tipness - 0.82) * 4) : CORAL_HEX
            const color = flash > 0.05 ? mix(CORAL, LIGHT, flash) : base
            px[y * w + x] = color + 1
          }
        }
      }

      // Partículas en órbita mientras Claude trabaja.
      if (isWorking || burst > 0) {
        for (let k = 0; k < 3; k += 1) {
          const a = -rot * 1.6 + (k * Math.PI * 2) / 3
          const orbit = radius + 1.4
          const ox = Math.round(cx + orbit * Math.cos(a))
          const oy = Math.round(cy + orbit * Math.sin(a))
          if (ox >= 0 && ox < w && oy >= 0 && oy < h) px[oy * w + ox] = mix(LIGHT, CORAL, k * 0.3) + 1
        }
      }

      const words = new Uint32Array(columns * rows * 3)
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < columns; col += 1) {
          const top = px[row * 2 * w + col] ?? 0
          const bottom = px[(row * 2 + 1) * w + col] ?? 0
          const at = (row * columns + col) * 3
          if (top !== 0) {
            words[at] = HALF_TOP
            words[at + 1] = top - 1
            words[at + 2] = bottom !== 0 ? bottom - 1 : DEFAULT
          } else if (bottom !== 0) {
            words[at] = HALF_BOTTOM
            words[at + 1] = bottom - 1
            words[at + 2] = DEFAULT
          } else {
            words[at] = 0x20
            words[at + 1] = DEFAULT
            words[at + 2] = DEFAULT
          }
        }
      }
      return toBase64(new Uint8Array(words.buffer))
    },
  }
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function toBase64(bytes: Uint8Array): string {
  let out = ''
  let i = 0
  for (; i + 2 < bytes.length; i += 3) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out += ALPHABET[(n >> 18) & 63]! + ALPHABET[(n >> 12) & 63]! + ALPHABET[(n >> 6) & 63]! + ALPHABET[n & 63]!
  }
  const left = bytes.length - i
  if (left === 1) {
    const n = (bytes[i] ?? 0) << 16
    out += ALPHABET[(n >> 18) & 63]! + ALPHABET[(n >> 12) & 63]! + '=='
  } else if (left === 2) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8)
    out += ALPHABET[(n >> 18) & 63]! + ALPHABET[(n >> 12) & 63]! + ALPHABET[(n >> 6) & 63]! + '='
  }
  return out
}

/** El mismo destello como SVG animado para las superficies que dibujan SVG. */
export function logoSvg(mood: Mood): string {
  const spin = mood === 'working' ? 3 : 24
  const rays = RAYS.map((len, i) => {
    const angle = (i / RAYS.length) * 360
    const tip = 44 * len
    const delay = (i * 0.12).toFixed(2)
    const pulse =
      mood === 'working'
        ? `<animateTransform attributeName="transform" type="scale" additive="sum" values="1;1.18;1" dur="1.2s" begin="${delay}s" repeatCount="indefinite"/>`
        : ''
    return `<g transform="rotate(${angle.toFixed(1)})"><path d="M0 -4.2 L${tip.toFixed(1)} -0.7 Q${(tip + 1.6).toFixed(1)} 0 ${tip.toFixed(1)} 0.7 L0 4.2 Z" fill="url(#c)">${pulse}</path></g>`
  }).join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-60 -60 120 120" width="120" height="120">` +
    `<defs><radialGradient id="c" cx="0" cy="0" r="50" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0" stop-color="#E8916F"/><stop offset="0.75" stop-color="#D97757"/><stop offset="1" stop-color="#B55538"/></radialGradient>` +
    `<radialGradient id="g"><stop offset="0" stop-color="#FFD2B8" stop-opacity="0.55"/><stop offset="1" stop-color="#FFD2B8" stop-opacity="0"/></radialGradient></defs>` +
    `<circle r="30" fill="url(#g)"><animate attributeName="r" values="22;34;22" dur="3.2s" repeatCount="indefinite"/></circle>` +
    `<g><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="${spin}s" repeatCount="indefinite"/>${rays}<circle r="4.6" fill="#D97757"/></g>` +
    `</svg>`
  )
}
