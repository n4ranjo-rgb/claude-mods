import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { CoachAdvice, CoachMode, CoachPick, CoachStats } from '../types'
import {
  LABEL,
  MODEL_ID,
  classify,
  contextTip,
  decide,
  effortOf,
  fmtTokens,
  relativeCost,
  samePick,
  tierOf,
  usageCost,
} from './engine'
import type { Advice } from './engine'
import { animator, logoSvg } from './logo'

const PANE = 'token-coach'
const TITLE = 'Token Coach'
const FPS_MS = 90
const DEFAULT_CTX = 25_000
const EMPTY_STATS: CoachStats = {
  turns: 0,
  lastInput: 0,
  lastOutput: 0,
  cacheHitPct: 0,
  context: 0,
  spentUsd: 0,
  baselineUsd: 0,
}

const adviceAtom = atom({ plugin: 'token-coach', key: 'advice' } as const, null)
const statsAtom = atom({ plugin: 'token-coach', key: 'stats' } as const, EMPTY_STATS)
const modeAtom = atom({ plugin: 'token-coach', key: 'mode' } as const, 'suggest')
const pinnedAtom = atom({ plugin: 'token-coach', key: 'pinned' } as const, null)
const workingAtom = atom({ plugin: 'token-coach', key: 'isWorking' } as const, false)

const EFFORT_LABEL = { low: 'bajo', medium: 'medio', high: 'alto', xhigh: 'muy alto', max: 'máximo' } as const
const TIER_COLOR = { haiku: '#7FB77E', sonnet: '#6FA8DC', opus: '#D97757', fable: '#C27BA0' } as const

function describe(pick: CoachPick): string {
  return `${LABEL[pick.tier]} · ${EFFORT_LABEL[pick.effort]}`
}

function bar(ratio: number, width: number): string {
  const filled = Math.max(1, Math.min(width, Math.round(Math.min(ratio, 1) * width)))
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

export const register: Register = on => {
  const logo = animator()
  let logoSize: { columns: number; rows: number } | undefined
  let skip = 0
  let pending: Advice | undefined
  let mainTurn: string | undefined
  let turnPick: { turnId: string; pick: CoachPick; isModelChanged: boolean } | undefined
  let warm: CoachPick | undefined
  let base: CoachPick | undefined
  let steps = 0

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'coach',
      description: 'Token Coach: abre el panel, o cambia de modo (auto | sugerir | reset)',
      argumentHint: '[auto|sugerir|reset]',
    })
    const saved = await $.store.get('mode')
    if (saved === 'auto' || saved === 'suggest') await update($, modeAtom, () => saved)
    void $.ui.open({ id: PANE, title: TITLE })

    $.clock.every(FPS_MS, () => {
      if (logoSize === undefined) return
      if (skip > 0) {
        skip -= 1
        return
      }
      const cells = logo.frame(logoSize.columns, logoSize.rows)
      void $.ui.blit({ requestId: PANE, key: 'logo', cells }).then(r => {
        if (r.deny !== undefined) skip = 15
      })
    })

    return next(e)
  })

  on('command.run', { command: 'coach' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'auto' || arg === 'sugerir' || arg === 'suggest') {
      const mode: CoachMode = arg === 'auto' ? 'auto' : 'suggest'
      await update($, modeAtom, () => mode)
      await $.store.set('mode', mode)
      return { text: `Token Coach en modo ${mode === 'auto' ? 'automático' : 'solo sugerencias'}.` }
    }
    if (arg === 'reset') {
      await update($, pinnedAtom, () => null)
      await update($, statsAtom, () => EMPTY_STATS)
      return { text: 'Token Coach: fijado quitado y estadísticas reiniciadas.' }
    }
    const opened = await $.ui.open({ id: PANE, title: TITLE })
    return { text: opened.isPlaced ? 'Panel Token Coach abierto.' : `Token Coach: ${opened.reason ?? 'sin espacio para el panel'}` }
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    mainTurn = e.turnId
    steps = 0
    if (e.text.trim() !== '' && !e.text.trim().startsWith('/')) {
      pending = classify(e.text)
      logo.setMood('burst')
    }
    logo.setMood('working')
    await update($, workingAtom, () => true)
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined || e.turnId !== mainTurn) return yield* next(e)
    steps += 1

    if (turnPick?.turnId !== e.turnId) {
      const baseTier = tierOf(e.model) ?? 'opus'
      const baseEffort = effortOf(e.effort) ?? 'medium'
      base = { tier: baseTier, effort: baseEffort }
      const stats = await read($, statsAtom)
      const ctx = stats.context > 0 ? stats.context : DEFAULT_CTX
      const mode = await read($, modeAtom)
      const pinned = await read($, pinnedAtom)
      const advice = pending

      let pick: CoachPick = warm ?? base
      let note = 'modo sugerencia: tú decides'
      if (pinned !== null) {
        pick = pinned
        note = 'fijado por ti'
      } else if (mode === 'auto' && advice !== undefined) {
        const decision = decide(advice, base, warm, ctx)
        pick = decision.pick
        note = decision.note
      } else if (mode !== 'auto') {
        pick = base
      }

      // Un id de modelo que no es de primera parte (Bedrock, Vertex, gateway) no se toca.
      const canSwapModel = /^claude-[a-z]+-\d/.test(e.model)
      if (!canSwapModel && pick.tier !== base.tier) {
        pick = { tier: base.tier, effort: pick.effort }
        note += ' · modelo bloqueado por tu proveedor'
      }
      if (e.effort === undefined) pick = { tier: pick.tier, effort: base.effort }

      turnPick = { turnId: e.turnId, pick, isModelChanged: pick.tier !== base.tier }
      if (advice !== undefined) {
        const view: CoachAdvice = {
          tier: advice.tier,
          effort: advice.effort,
          category: advice.category,
          reasons: advice.reasons,
          applied: pick,
          base,
          relative: relativeCost(advice, base, ctx),
          note,
        }
        await update($, adviceAtom, () => view)
        $.ui.status(`◆ Coach: ${describe(advice)}${samePick(pick, base) ? '' : ` → aplicado ${describe(pick)}`}`)
      }
      pending = undefined
    }

    const pick = turnPick.pick
    const model = pick.tier === tierOf(e.model) ? e.model : MODEL_ID[pick.tier]
    const effort = e.effort === undefined ? undefined : pick.effort
    warm = pick
    return yield* next({ ...e, model, ...(effort === undefined ? {} : { effort }) })
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined || e.turnId !== mainTurn) return next(e)
    logo.setMood('idle')
    await update($, workingAtom, () => false)

    if (e.reason === 'error' && turnPick?.isModelChanged) {
      warm = undefined
      await update($, modeAtom, () => 'suggest')
      await $.store.set('mode', 'suggest')
      $.ui.toast('Token Coach: el modelo elegido falló; vuelvo a modo sugerencia.')
    }

    const u = e.usage
    if (u !== undefined) {
      const tier = tierOf(u.model) ?? 'opus'
      const baseTier = base?.tier ?? tier
      const read_ = u.cache_read_input_tokens ?? 0
      const written = u.cache_creation_input_tokens ?? 0
      const totalIn = u.input_tokens + read_ + written
      const perStep = totalIn / Math.max(1, steps)
      await update($, statsAtom, s => ({
        turns: s.turns + 1,
        lastInput: totalIn,
        lastOutput: u.output_tokens,
        cacheHitPct: totalIn > 0 ? Math.round((read_ / totalIn) * 100) : 0,
        context: Math.round(perStep),
        spentUsd: s.spentUsd + usageCost(tier, u),
        baselineUsd: s.baselineUsd + usageCost(baseTier, u),
      }))
    }
    return next(e)
  })

  on('ui.close', { id: PANE }, ($, e, next) => {
    logoSize = undefined
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const advice = await read($, adviceAtom)
    const stats = await read($, statsAtom)
    const mode = await read($, modeAtom)
    const pinned = await read($, pinnedAtom)
    const isWorking = await read($, workingAtom)
    const width = Math.max(24, e.props.bodyColumns)
    const isInline = e.props.placement === 'inline'
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui

    let logoNode
    if (e.surface === 'terminal' && 'Raster' in ui) {
      const { Raster } = ui
      const columns = Math.max(14, Math.min(isInline ? 16 : 28, (width - 2) & ~1))
      const rows = columns / 2
      logoSize = { columns, rows }
      skip = 0
      logoNode = <Raster key="logo" columns={columns} rows={rows} cells={logo.frame(columns, rows)} />
    } else if ('Svg' in ui) {
      const { Svg } = ui
      logoNode = (
        <Svg
          source={logoSvg(isWorking ? 'working' : 'idle')}
          alt="Logo de Claude animado"
          width={96}
          height={96}
          isInteractive
        />
      )
    }

    const savedUsd = stats.baselineUsd - stats.spentUsd
    const savedPct = stats.baselineUsd > 0 ? Math.round((savedUsd / stats.baselineUsd) * 100) : 0
    const tip = contextTip(stats.context)
    const barWidth = Math.max(8, Math.min(20, width - 18))

    return (
      <Box flexDirection="column" gap={0}>
        <Box flexDirection="column" alignItems="center">
          {logoNode}
          <Text bold color="#D97757">
            TOKEN COACH
          </Text>
          <Text dimColor>{isWorking ? 'Claude está trabajando…' : 'modelo justo, esfuerzo justo'}</Text>
        </Box>

        <Box flexDirection="column" borderStyle="round" borderColor="#D97757" paddingX={1} marginTop={1}>
          {advice === null ? (
            <Text dimColor>Escribe un prompt y te diré qué modelo y esfuerzo usar.</Text>
          ) : (
            <Box flexDirection="column">
              <Text dimColor>RECOMENDADO · {advice.category}</Text>
              <Text bold color={TIER_COLOR[advice.tier]}>
                ◆ {LABEL[advice.tier]}
                <Text color="#D97757"> · esfuerzo {EFFORT_LABEL[advice.effort]}</Text>
              </Text>
              {advice.reasons.slice(0, isInline ? 1 : 3).map(r => (
                <Text dimColor wrap="wrap">
                  · {r}
                </Text>
              ))}
              <Text>
                Coste <Text color={advice.relative <= 1 ? '#7FB77E' : '#E06666'}>{bar(advice.relative / 2, barWidth)}</Text>{' '}
                {advice.relative.toFixed(advice.relative < 0.1 ? 2 : 1)}×
              </Text>
              <Text dimColor>Tu sesión: {describe(advice.base)}</Text>
              <Text>
                Aplicado: <Text bold>{describe(advice.applied)}</Text>
              </Text>
              <Text dimColor wrap="wrap">
                {advice.note}
              </Text>
            </Box>
          )}
        </Box>

        <Box flexDirection="column" paddingX={1} marginTop={1}>
          <Text dimColor>SESIÓN</Text>
          <Text>
            Último turno: {fmtTokens(stats.lastInput)} in · {fmtTokens(stats.lastOutput)} out
          </Text>
          <Text>
            Caché: <Text color={stats.cacheHitPct >= 70 ? '#7FB77E' : '#E6B85C'}>{stats.cacheHitPct}%</Text> · contexto ~
            {fmtTokens(stats.context)}
          </Text>
          <Text>
            Gasto ≈ ${stats.spentUsd.toFixed(3)}
            {savedUsd > 0.0005 ? <Text color="#7FB77E"> (−{savedPct}% ahorro)</Text> : ''}
          </Text>
          {tip !== undefined && <Text color="#E6B85C">⚠ {tip}</Text>}
        </Box>

        <Box flexDirection="row" flexWrap="wrap" columnGap={1} marginTop={1}>
          <Button
            key="mode"
            hotkey="m"
            variant={mode === 'auto' ? 'primary' : 'secondary'}
            label={mode === 'auto' ? 'Modo: Auto' : 'Modo: Sugerir'}
            onPress={async () => {
              const nextMode: CoachMode = mode === 'auto' ? 'suggest' : 'auto'
              await update($, modeAtom, () => nextMode)
              await $.store.set('mode', nextMode)
              $.ui.toast(nextMode === 'auto' ? 'Auto: baja modelo/esfuerzo solo cuando compensa' : 'Solo sugerencias')
            }}
          />
          {advice !== null && pinned === null && (
            <Button
              key="pin"
              hotkey="f"
              label="Fijar"
              onPress={() => update($, pinnedAtom, () => ({ tier: advice.tier, effort: advice.effort }))}
            />
          )}
          {pinned !== null && (
            <Button key="unpin" hotkey="r" label={`Quitar fijado (${LABEL[pinned.tier]})`} onPress={() => update($, pinnedAtom, () => null)} />
          )}
        </Box>
        {!isInline && (
          <Text dimColor wrap="wrap">
            0 tokens: el análisis es local. /coach auto · /coach sugerir · /coach reset
          </Text>
        )}
      </Box>
    )
  })
}
