export type CoachTier = 'haiku' | 'sonnet' | 'opus' | 'fable'
export type CoachEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'
export type CoachPick = { tier: CoachTier; effort: CoachEffort }
export type CoachMode = 'suggest' | 'auto'

export type CoachAdvice = CoachPick & {
  category: string
  reasons: string[]
  /** Lo que se aplica de verdad este turno. */
  applied: CoachPick
  /** Tu configuración de sesión (modelo y effort de /model). */
  base: CoachPick
  /** Coste relativo de la recomendación frente a la base (1 = igual). */
  relative: number
  note: string
}

export type CoachStats = {
  turns: number
  lastInput: number
  lastOutput: number
  cacheHitPct: number
  context: number
  spentUsd: number
  baselineUsd: number
}

declare module 'claude-code' {
  interface PluginState {
    'token-coach': {
      advice: CoachAdvice | null
      stats: CoachStats
      mode: CoachMode
      pinned: CoachPick | null
      isWorking: boolean
    }
  }
}
