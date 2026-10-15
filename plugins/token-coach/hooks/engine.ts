// Motor de recomendación: 100 % local, sin llamadas al modelo (no gasta tokens).
// Clasifica el prompt, elige modelo + esfuerzo y decide si cambiar compensa
// teniendo en cuenta la caché de prompts (cambiar de modelo o de effort la invalida).

export type Tier = 'haiku' | 'sonnet' | 'opus' | 'fable'
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export type Pick = { tier: Tier; effort: Effort }

export type Advice = Pick & {
  level: number
  category: string
  reasons: string[]
}

// $ por millón de tokens (API de Anthropic, tarifas de primera parte, 2026-10).
export const PRICES: Record<Tier, { input: number; output: number; cacheRead: number }> = {
  haiku: { input: 0.1, output: 0.5, cacheRead: 0.01 },
  sonnet: { input: 2, output: 10, cacheRead: 0.2 },
  opus: { input: 4, output: 20, cacheRead: 0.2 },
  fable: { input: 10, output: 50, cacheRead: 0.25 },
}

export const LABEL: Record<Tier, string> = {
  haiku: 'Haiku 5.5',
  sonnet: 'Sonnet 5.5',
  opus: 'Opus 5.5',
  fable: 'Fable 5.1',
}

export const MODEL_ID: Record<Tier, string> = {
  haiku: 'claude-haiku-5-5',
  sonnet: 'claude-sonnet-5-5',
  opus: 'claude-opus-5-5',
  fable: 'claude-fable-5-1',
}

export const EFFORTS: readonly Effort[] = ['low', 'medium', 'high', 'xhigh', 'max']

// Tokens de salida (pensamiento incluido) y peticiones por turno, aproximados por effort.
const OUT_TOKENS: Record<Effort, number> = { low: 1200, medium: 3500, high: 8000, xhigh: 15000, max: 26000 }
const STEPS: Record<Effort, number> = { low: 1, medium: 3, high: 5, xhigh: 8, max: 10 }

// Escalera de recomendaciones, de la más barata a la más potente.
export const LADDER: readonly Pick[] = [
  { tier: 'haiku', effort: 'low' },
  { tier: 'haiku', effort: 'medium' },
  { tier: 'sonnet', effort: 'low' },
  { tier: 'sonnet', effort: 'medium' },
  { tier: 'opus', effort: 'medium' },
  { tier: 'opus', effort: 'high' },
  { tier: 'opus', effort: 'xhigh' },
  { tier: 'fable', effort: 'high' },
]

type Rule = { level: number; category: string; why: string; re: RegExp }

// El texto se normaliza (minúsculas, sin tildes) antes de comparar.
const RULES: readonly Rule[] = [
  {
    level: 7,
    category: 'Investigación crítica',
    why: 'pide el máximo razonamiento (investigación profunda / prueba formal)',
    re: /\b(investigacion profunda|deep research|demostracion formal|prueba matematica|maximo razonamiento|el mejor modelo|fable)\b/,
  },
  {
    level: 6,
    category: 'Trabajo profundo',
    why: 'alcance amplio o crítico (a fondo, desde cero, producción, auditoría)',
    re: /\b(a fondo|exhaustiv\w*|desde cero|from scratch|app completa|sistema completo|auditori\w*|audit|critico|produccion|production|estrategia|plan completo|end to end|e2e completo)\b/,
  },
  {
    level: 5,
    category: 'Ingeniería compleja',
    why: 'cambio de diseño o multi-archivo (refactor, arquitectura, migración, seguridad)',
    re: /\b(refactori?\w*|arquitectur\w*|architecture|disen\w*|design|migra\w*|migrate|rendimiento|performance|seguridad|security|vulnerab\w*|concurren\w*|race condition|deadlock|memory leak|fuga de memoria|todo el (repo|proyecto|codigo)|varios archivos|multiples archivos|investiga\w*|optimiza\w*)\b/,
  },
  {
    level: 0,
    category: 'Tarea mecánica',
    why: 'tarea mecánica y corta (renombrar, formatear, traducir, resumir)',
    re: /\b(renombra\w*|rename|formatea\w*|format|traduc\w*|translate|typo|ortografia|resume\w*|resumen|summari\w*|mensaje de commit|commit message|git status|lista(r)? (los|las|archivos)|list files|convierte a|regex|lint)\b/,
  },
  {
    level: 3,
    category: 'Código acotado',
    why: 'tarea de código concreta (implementar, arreglar, probar)',
    re: /\b(implementa\w*|implement|agrega\w*|anade\w*|add|crea\w*|create|arregla\w*|fix\w*|bug|error|falla\w*|test\w*|prueba\w*|endpoint|componente|component|funcion|function|clase|class|script|actualiza\w*|update|css|estilo\w*|hook|query|sql|api)\b/,
  },
  {
    level: 1,
    category: 'Pregunta o explicación',
    why: 'pregunta o explicación sin cambios de código',
    re: /^(que|como|por que|cual|cuando|donde|what|how|why|which|when|where|explica\w*|explain|describe)\b/,
  },
  {
    level: 0,
    category: 'Conversación',
    why: 'mensaje corto de conversación',
    re: /^(hola|gracias|ok|okay|vale|perfecto|listo|genial|si|no|thanks|thank you|hi|hello|yes|great)\b[\s!.]*$/,
  },
]

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function classify(raw: string): Advice {
  const text = normalize(raw.trim())
  const reasons: string[] = []

  const hit = RULES.find(rule => rule.re.test(text))
  let level = hit ? hit.level : text.length > 400 ? 4 : 3
  const category = hit ? hit.category : 'Tarea general'
  reasons.push(hit ? hit.why : 'sin señales claras: punto medio equilibrado')

  const files = (raw.match(/[\w./-]+\.[a-z]{1,5}\b/gi) ?? []).filter(f => f.includes('/') || /\.(ts|tsx|js|py|go|rs|java|rb|php|cs|css|html|json|md|sql|yml|yaml)$/i.test(f))
  if (files.length >= 3) {
    level += 1
    reasons.push(`${files.length} archivos mencionados`)
  }
  if (raw.length > 1500) {
    level += 1
    reasons.push('prompt largo y detallado')
  }
  if (/```/.test(raw) && level < 3) {
    level += 1
    reasons.push('incluye bloque de código')
  }
  if (/\b(rapido|simple|sencill\w*|solo|nomas|breve|quick|just|small|pequen\w*)\b/.test(text)) {
    level -= 1
    reasons.push('pides algo rápido o simple')
  }
  if (/\b(cuidado|meticulos\w*|no falles|muy importante|careful|thorough)\b/.test(text)) {
    level += 1
    reasons.push('pides máximo cuidado')
  }
  if (text.length < 80 && text.endsWith('?') && level > 1 && level < 5) {
    level -= 1
    reasons.push('pregunta corta')
  }

  level = Math.max(0, Math.min(LADDER.length - 1, level))
  // Fable solo cuando se pide explícitamente lo máximo: nunca por acumulación de señales.
  if (level === 7 && hit?.level !== 7) level = 6

  const pick = LADDER[level] ?? LADDER[3]!
  return { ...pick, level, category, reasons }
}

export function tierOf(model: string | undefined): Tier | undefined {
  const m = (model ?? '').toLowerCase()
  if (m.includes('haiku')) return 'haiku'
  if (m.includes('sonnet')) return 'sonnet'
  if (m.includes('opus')) return 'opus'
  if (m.includes('fable') || m.includes('mythos')) return 'fable'
  return undefined
}

export function effortOf(value: unknown): Effort | undefined {
  return typeof value === 'string' && (EFFORTS as readonly string[]).includes(value) ? (value as Effort) : undefined
}

/** Coste estimado ($) de un turno con `ctx` tokens de contexto. */
export function turnCost(pick: Pick, ctx: number, isWarm: boolean): number {
  const p = PRICES[pick.tier]
  const steps = STEPS[pick.effort]
  const first = isWarm ? ctx * p.cacheRead : ctx * p.input * 1.25
  const rest = (steps - 1) * ctx * p.cacheRead
  const out = OUT_TOKENS[pick.effort] * p.output
  return (first + rest + out) / 1e6
}

export function samePick(a: Pick | undefined, b: Pick | undefined): boolean {
  return a !== undefined && b !== undefined && a.tier === b.tier && a.effort === b.effort
}

export type Decision = {
  pick: Pick
  isChange: boolean
  /** Ahorro estimado en 3 turnos frente a quedarse; negativo si cuesta más. */
  savingsPct: number
  note: string
}

/**
 * Decide qué aplicar en modo automático. Reglas:
 * 1. Nunca gasta más que tu configuración base por su cuenta (solo baja).
 * 2. Solo cambia si, contando la reescritura de caché, ahorra >20 % en 3 turnos.
 */
export function decide(advice: Pick, base: Pick, warm: Pick | undefined, ctx: number): Decision {
  const current = warm ?? base
  const stay = 3 * turnCost(current, ctx, warm !== undefined)
  const target = turnCost(advice, ctx, false) > turnCost(base, ctx, false) ? base : advice
  if (samePick(target, current)) {
    return { pick: current, isChange: false, savingsPct: 0, note: 'ya estás en la opción óptima' }
  }
  const go = turnCost(target, ctx, samePick(target, warm)) + 2 * turnCost(target, ctx, true)
  const savingsPct = Math.round((1 - go / stay) * 100)
  if (go < stay * 0.8) {
    return { pick: target, isChange: true, savingsPct, note: `cambio rentable (~${savingsPct}% menos)` }
  }
  return {
    pick: current,
    isChange: false,
    savingsPct,
    note: 'no compensa: reescribir la caché costaría más que el ahorro',
  }
}

/** Coste real ($) de un uso medido, con los precios de `tier`. */
export function usageCost(
  tier: Tier,
  u: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number },
): number {
  const p = PRICES[tier]
  return (
    (u.input_tokens * p.input +
      (u.cache_creation_input_tokens ?? 0) * p.input * 1.25 +
      (u.cache_read_input_tokens ?? 0) * p.cacheRead +
      u.output_tokens * p.output) /
    1e6
  )
}

/** Coste relativo frente a la base, para la barra del panel (1 = igual). */
export function relativeCost(pick: Pick, base: Pick, ctx: number): number {
  return turnCost(pick, ctx, false) / Math.max(1e-9, turnCost(base, ctx, false))
}

export function contextTip(ctx: number): string | undefined {
  if (ctx > 300_000) return 'Contexto enorme: usa /clear al cambiar de tarea'
  if (ctx > 120_000) return 'Contexto grande: /compact reduce el coste por turno'
  return undefined
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n))
}
