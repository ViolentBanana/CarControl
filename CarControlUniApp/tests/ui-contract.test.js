import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = (relativePath) => readFileSync(
  fileURLToPath(new URL(`../src/${relativePath}`, import.meta.url)),
  'utf8',
)

describe('vehicle control interface', () => {
  it('uses the compact red-black remote composition', () => {
    const page = source('pages/control/control.vue')
    const button = source('components/VehicleControlButton.vue')

    expect(page).toContain('remote-console')
    expect(page).toContain('primary-lock')
    expect(page).toContain('连接 RM3 后可操作')
    expect(button).toContain('control-button--secondary')
  })

  it('reserves tall-screen remote spacing in normal flow', () => {
    const page = source('pages/control/control.vue')

    expect(page).toMatch(/@media \(min-height: 800px\)\s*\{\s*\.remote-zone\s*\{\s*min-height: 302px;\s*\}/s)
    expect(page).not.toMatch(/\.remote-zone\s*\{[^}]*transform:\s*translateY/s)
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
