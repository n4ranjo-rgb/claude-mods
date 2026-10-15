import { describe, expect, mock, test } from 'claude-code/testing'

import { classify, decide, relativeCost, turnCost } from '../hooks/engine'
import { animator, logoSvg } from '../hooks/logo'

const OPUS_MEDIUM = { tier: 'opus', effort: 'medium' } as const

describe('clasificador', () => {
  test('tareas mecánicas van a Haiku', async () => {
    expect(classify('renombra la variable foo a bar').tier).toBe('haiku')
    expect(classify('escribe el mensaje de commit').tier).toBe('haiku')
    expect(classify('gracias!').tier).toBe('haiku')
  })

  test('código acotado va a Sonnet', async () => {
    expect(classify('arregla el bug del login en src/auth.ts').tier).toBe('sonnet')
    expect(classify('implementa un endpoint para listar usuarios').tier).toBe('sonnet')
  })

  test('diseño y refactor van a Opus', async () => {
    const a = classify('refactoriza la arquitectura del módulo de pagos')
    expect(a.tier).toBe('opus')
    expect(a.effort).toBe('high')
    expect(classify('haz una auditoría de seguridad a fondo').effort).toBe('xhigh')
  })

  test('Fable solo si se pide lo máximo explícitamente', async () => {
    expect(classify('haz una investigación profunda del algoritmo').tier).toBe('fable')
    expect(classify('refactoriza a fondo todo el proyecto con mucho cuidado, varios archivos').tier).toBe('opus')
  })

  test('"rápido" baja un nivel', async () => {
    expect(classify('implementa rápido un test').level).toBeLessThan(classify('implementa un test').level)
  })
})

describe('decisión con caché', () => {
  test('nunca sube por su cuenta por encima de tu sesión', async () => {
    const d = decide({ tier: 'fable', effort: 'high' }, OPUS_MEDIUM, undefined, 25_000)
    expect(d.pick).toEqual(OPUS_MEDIUM)
    expect(d.isChange).toBe(false)
  })

  test('bajar a Haiku compensa casi siempre', async () => {
    const d = decide({ tier: 'haiku', effort: 'low' }, OPUS_MEDIUM, OPUS_MEDIUM, 80_000)
    expect(d.isChange).toBe(true)
    expect(d.pick.tier).toBe('haiku')
  })

  test('con contexto enorme y caché caliente no cambia por poco', async () => {
    const d = decide({ tier: 'opus', effort: 'low' }, OPUS_MEDIUM, OPUS_MEDIUM, 600_000)
    expect(d.isChange).toBe(false)
  })

  test('los costes son coherentes', async () => {
    expect(turnCost({ tier: 'haiku', effort: 'low' }, 25_000, false)).toBeLessThan(turnCost(OPUS_MEDIUM, 25_000, false))
    expect(relativeCost(OPUS_MEDIUM, OPUS_MEDIUM, 25_000)).toBe(1)
  })
})

describe('logo', () => {
  test('cada fotograma tiene el tamaño exacto del Raster', async () => {
    const anim = animator()
    for (const [columns, rows] of [[28, 14], [16, 8]] as const) {
      const cells = anim.frame(columns, rows)
      expect(cells.length).toBe(Math.ceil((columns * rows * 12) / 3) * 4)
    }
    anim.setMood('working')
    expect(anim.frame(20, 10).length).toBe(Math.ceil((20 * 10 * 12) / 3) * 4)
    expect(logoSvg('working')).toContain('<svg')
  })
})

const PANE = {
  title: 'Token Coach',
  isFocused: false,
  bodyColumns: 42,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
}

test('el panel se dibuja en terminal y desktop, y el modo cambia', async ($, on) => {
  mock.store(on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'token-coach', surface, component: 'Pane', requestId: 'token-coach', props: PANE })
    expect(await ui.find({ type: 'Text', text: /TOKEN COACH/ })).toBeDefined()
    expect((await ui.find({ key: 'mode' }))?.props.label).toBe('Modo: Sugerir')
    await ui.press({ key: 'mode' })
    expect((await ui.find({ key: 'mode' }))?.props.label).toBe('Modo: Auto')
    await ui.press({ key: 'mode' })
    await ui.unmount()
  }
})

test('sin pantalla (Claude Code en la web), /coach responde en texto', async ($, on) => {
  mock.store(on)
  on('session.surfaces', () => ({ value: [] }))
  const tarea = await $.command.run({ command: 'coach', args: 'renombra la variable x a total' })
  expect(tarea.text).toContain('Haiku 5.5')
  expect(tarea.text).toContain('/model claude-haiku-5-5')
  const informe = await $.command.run({ command: 'coach', args: '' })
  expect(informe.text).toContain('Token Coach')
  expect(informe.text).toContain('Modo:')
  const auto = await $.command.run({ command: 'coach', args: 'auto' })
  expect(auto.text).toContain('automático')
})
