import { describe, expect, it } from 'vitest'
import { VehicleCommand } from '../src/domain/vehicle-command.js'
import {
  canActivateControl,
  connectionPresentation,
  createControlState,
  isReady,
} from '../src/domain/vehicle-control-state.js'
import { isTargetDevice, normalizeUuid, stringToArrayBuffer } from '../src/utils/ble-data.js'

describe('vehicle domain', () => {
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

  it('blocks activation when a control is disabled', () => {
    expect(canActivateControl({ enabled: false, busy: false })).toBe(false)
  })

  it('blocks activation while the selected control is busy', () => {
    expect(canActivateControl({ enabled: true, busy: true })).toBe(false)
  })

  it('allows activation only when enabled and idle', () => {
    expect(canActivateControl({ enabled: true, busy: false })).toBe(true)
  })

  it('keeps sending connected-looking without allowing another command', () => {
    expect(connectionPresentation('ready')).toEqual({ connected: true, pulse: false })
    expect(connectionPresentation('sending')).toEqual({ connected: true, pulse: false })
  })

  it('pulses status only while scanning or connecting', () => {
    expect(connectionPresentation('scanning').pulse).toBe(true)
    expect(connectionPresentation('connecting').pulse).toBe(true)
    for (const phase of ['discovering', 'ready', 'sending', 'failure', 'disconnected', 'unavailable']) {
      expect(connectionPresentation(phase).pulse).toBe(false)
    }
  })

  it('matches RM3 case-insensitively and normalizes FFF0', () => {
    expect(isTargetDevice({ name: 'rm3-car' })).toBe(true)
    expect(isTargetDevice({ name: 'speaker' })).toBe(false)
    expect(normalizeUuid('0000fff0-0000-1000-8000-00805f9b34fb')).toBe('FFF0')
  })

  it('encodes command text as UTF-8 bytes', () => {
    expect([...new Uint8Array(stringToArrayBuffer('MSF'))]).toEqual([77, 83, 70])
  })
})
