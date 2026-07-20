import { describe, expect, it, vi } from 'vitest'
import { createBluetoothService } from '../src/services/bluetooth-service.js'

function createFakeUni() {
  const api = {
    onBluetoothDeviceFound: vi.fn((handler) => { api.foundHandler = handler }),
    offBluetoothDeviceFound: vi.fn(),
    onBLEConnectionStateChange: vi.fn((handler) => { api.connectionHandler = handler }),
    offBLEConnectionStateChange: vi.fn(),
  }

  for (const method of [
    'openBluetoothAdapter',
    'getConnectedBluetoothDevices',
    'startBluetoothDevicesDiscovery',
    'stopBluetoothDevicesDiscovery',
    'createBLEConnection',
    'closeBLEConnection',
    'getBLEDeviceServices',
    'getBLEDeviceCharacteristics',
    'writeBLECharacteristicValue',
  ]) {
    api[method] = vi.fn((options) => {
      if (method === 'writeBLECharacteristicValue') api.lastWrite = options
      options.success({ ok: true })
    })
  }

  return api
}

describe('bluetooth service', () => {
  it('converts callback operations and command text', async () => {
    const fakeUni = createFakeUni()
    const service = createBluetoothService(fakeUni)

    await service.open()
    await service.write({
      deviceId: 'D1',
      serviceId: 'FFF0',
      characteristicId: 'C1',
      value: 'MSF',
    })

    expect(fakeUni.openBluetoothAdapter).toHaveBeenCalledOnce()
    expect(fakeUni.writeBLECharacteristicValue).toHaveBeenCalledOnce()
    expect([...new Uint8Array(fakeUni.lastWrite.value)]).toEqual([77, 83, 70])
  })

  it('owns and removes native listeners', () => {
    const fakeUni = createFakeUni()
    const service = createBluetoothService(fakeUni)
    const found = vi.fn()
    const changed = vi.fn()
    service.onDeviceFound(found)
    service.onConnectionChange(changed)

    fakeUni.foundHandler({ devices: [{ deviceId: 'D1' }] })
    fakeUni.connectionHandler({ deviceId: 'D1', connected: false })
    service.dispose()

    expect(found).toHaveBeenCalledWith([{ deviceId: 'D1' }])
    expect(changed).toHaveBeenCalledWith({ deviceId: 'D1', connected: false })
    expect(fakeUni.offBluetoothDeviceFound).toHaveBeenCalledOnce()
    expect(fakeUni.offBLEConnectionStateChange).toHaveBeenCalledOnce()
  })
})
