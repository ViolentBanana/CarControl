import { afterEach, describe, expect, it, vi } from 'vitest'
import { VehicleCommand } from '../src/domain/vehicle-command.js'
import { createControlState, isReady } from '../src/domain/vehicle-control-state.js'
import { isTargetDevice, normalizeUuid, stringToArrayBuffer } from '../src/utils/ble-data.js'

describe('vehicle domain', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('keeps the exact BLE commands', () => {
    expect(VehicleCommand.lock.value).toBe('MSF')
    expect(VehicleCommand.unlock.value).toBe('MCF')
    expect(VehicleCommand.trunk.value).toBe('MCK')
  })

  it('only treats ready as controllable', () => {
    expect(isReady(createControlState('disconnected'))).toBe(false)
    expect(isReady(createControlState('ready', { deviceName: 'RM3-01' }))).toBe(true)
    expect(isReady(createControlState('sending', { command: 'MSF' }))).toBe(false)
  })

  it('matches RM0 and RM3 case-insensitively and normalizes FFF0', () => {
    expect(isTargetDevice({ name: 'rm0-lock' })).toBe(true)
    expect(isTargetDevice({ name: 'rm3-car' })).toBe(true)
    expect(isTargetDevice({ name: 'speaker' })).toBe(false)
    expect(normalizeUuid('0000fff0-0000-1000-8000-00805f9b34fb')).toBe('FFF0')
  })

  it('encodes BLE command text as ASCII bytes', () => {
    expect([...new Uint8Array(stringToArrayBuffer('MSF'))]).toEqual([77, 83, 70])
  })

  it('encodes BLE commands without the browser TextEncoder API', () => {
    vi.stubGlobal('TextEncoder', undefined)

    expect([...new Uint8Array(stringToArrayBuffer('MCK'))]).toEqual([77, 67, 75])
  })
})
