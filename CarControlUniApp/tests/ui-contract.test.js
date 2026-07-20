import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = (relativePath) => readFileSync(
  fileURLToPath(new URL(`../src/${relativePath}`, import.meta.url)),
  'utf8',
)

describe('vehicle control interface', () => {
  it('keeps the approved visible control labels', () => {
    const page = source('pages/control/control.vue')
    const header = source('components/ConnectionHeader.vue')
    const button = source('components/VehicleControlButton.vue')
    const log = source('components/DebugLogPanel.vue')
    const combined = [page, header, button, log].join('\n')

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
})
