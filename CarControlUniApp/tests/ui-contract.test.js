import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = (relativePath) => readFileSync(
  fileURLToPath(new URL(`../src/${relativePath}`, import.meta.url)),
  'utf8',
)

function declarations(relativePath, selector) {
  const css = source(relativePath).match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1] ?? ''
  const result = {}

  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!match[1].split(',').map((part) => part.trim()).includes(selector)) continue
    for (const entry of match[2].split(';')) {
      const [property, value] = entry.split(':', 2).map((part) => part.trim())
      if (property && value && !(property in result)) result[property] = value
    }
  }

  return result
}

function pixelValues(value = '') {
  return [...value.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map((match) => Number(match[1]))
}

describe('vehicle control interface', () => {
  it('uses the compact red-black remote composition', () => {
    const page = source('pages/control/control.vue')
    const button = source('components/VehicleControlButton.vue')

    expect(page).toContain('remote-console')
    expect(page).toContain('primary-lock')
    expect(page).toContain('连接 RM3 后可操作')
    expect(button).toContain('control-button--secondary')
  })

  it('keeps the remote in responsive normal flow without a tall-screen jump', () => {
    const pageLayout = declarations('pages/control/control.vue', '.control-page')
    const contentLayout = declarations('pages/control/control.vue', '.content')
    const remoteLayout = declarations('pages/control/control.vue', '.remote-zone')
    const heroLayout = declarations('components/VehicleHero.vue', '.vehicle-hero')

    expect(pageLayout['min-height']).toBe('100vh')
    expect(pageLayout.height).toBeUndefined()
    expect(contentLayout['min-height']).toBe('100vh')
    expect(contentLayout.height).toBeUndefined()
    expect(contentLayout.overflow).not.toBe('hidden')
    expect(remoteLayout.position ?? '').not.toMatch(/absolute|fixed/)
    expect(remoteLayout.transform).toBeUndefined()
    expect(heroLayout.flex).toBe('1 1 0')
    expect(heroLayout['min-height']).toBe('0')
  })

  it('keeps the fixed UI inside an 812px viewport budget', () => {
    const content = declarations('pages/control/control.vue', '.content')
    const remote = declarations('pages/control/control.vue', '.remote-zone')
    const hint = declarations('pages/control/control.vue', '.connection-hint')
    const consoleLayout = declarations('pages/control/control.vue', '.remote-console')
    const banner = declarations('pages/control/control.vue', '.result-banner')
    const titleRow = declarations('components/ConnectionHeader.vue', '.title-row')
    const statusRow = declarations('components/ConnectionHeader.vue', '.status-row')
    const [contentTop, , contentBottom] = pixelValues(content.padding)
    const fixedBudget = contentTop
      + 47 // conservative native status bar
      + contentBottom
      + 34 // conservative bottom safe area
      + pixelValues(titleRow['min-height'])[0]
      + pixelValues(statusRow['min-height'])[0]
      + Math.max(...pixelValues(remote['margin-top']))
      + pixelValues(hint['min-height'])[0]
      + pixelValues(consoleLayout.height)[0]
      + pixelValues(banner['margin-top'])[0]
      + pixelValues(banner['min-height'])[0]

    expect(fixedBudget).toBeLessThan(812)
    expect(812 - fixedBudget).toBeGreaterThan(240)
  })

  it('separates connected appearance from command availability while sending', () => {
    const page = source('pages/control/control.vue')
    const button = source('components/VehicleControlButton.vue')
    const domain = source('domain/vehicle-control-state.js')

    expect(domain).not.toContain('canActivateControl')
    expect(domain).not.toContain('connectionPresentation')
    expect(page).not.toContain('connectionPresentation')
    expect(page).toContain(':connected="connected"')
    expect(page).toContain(':enabled="ready"')
    expect(page).toContain("'is-hidden': connected")
    expect(button).not.toContain("../domain/vehicle-control-state.js")
    expect(button).toContain(':disabled="!canActivate"')
    expect(button).toContain("'control-button--connected': connected")
  })

  it('maps the status pulse explicitly into the connection header', () => {
    const page = source('pages/control/control.vue')
    const header = source('components/ConnectionHeader.vue')

    expect(page).toContain(':ready="ready"')
    expect(page).toContain(':pulse="pulse"')
    expect(header).toContain("ready: { type: Boolean, default: false }")
    expect(header).toContain("pulse: { type: Boolean, default: false }")
    expect(header).toContain("'status-dot--pulse': pulse")
  })

  it('keeps the approved visible control labels', () => {
    const page = source('pages/control/control.vue')
    const header = source('components/ConnectionHeader.vue')
    const button = source('components/VehicleControlButton.vue')
    const log = source('components/DebugLogPanel.vue')
    const commands = source('domain/vehicle-command.js')
    const combined = [page, header, button, log, commands].join('\n')

    for (const label of ['Q60S 控制', 'RM3', '锁车', '开锁', '尾箱', '日志', '重新扫描']) {
      expect(combined).toContain(label)
    }
  })

  it('emits the selected command key from every command button', () => {
    const button = source('components/VehicleControlButton.vue')

    expect(button).toContain("defineEmits(['command'])")
    expect(button).toContain("emit('command', props.command.key)")
  })

  it('uses the closed and open Q60S vehicle artwork', () => {
    const hero = source('components/VehicleHero.vue')

    expect(hero).toContain('/static/vehicle/vehicle-top.png')
    expect(hero).toContain('/static/vehicle/vehicle-top-trunk-open.png')
    expect(hero).toContain('尾箱指令已发送')
  })

  it('states that H5 cannot control Bluetooth', () => {
    expect(source('pages/control/control.vue')).toContain('当前平台不支持蓝牙控制')
  })

  it('reserves the native status bar above the custom header', () => {
    expect(source('pages/control/control.vue')).toContain('var(--status-bar-height)')
  })
})
