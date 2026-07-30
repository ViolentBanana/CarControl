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

function createFakePlus() {
  const devices = [
    {
      getName: () => 'Headphones',
      getAddress: () => '11:22:33:44:55:66',
    },
    {
      getName: () => 'RM0-LOCK',
      getAddress: () => 'AA:BB:CC:DD:EE:FF',
    },
  ]
  let index = 0
  const iterator = {
    hasNext: () => index < devices.length,
    next: () => devices[index++],
  }
  const adapter = {
    getBondedDevices: () => ({
      iterator: () => iterator,
    }),
  }
  return {
    android: {
      importClass: vi.fn((name) => (
        name === 'android.bluetooth.BluetoothAdapter'
          ? { getDefaultAdapter: () => adapter }
          : name
      )),
      runtimeMainActivity: vi.fn(() => {
        throw new Error('不应通过 Context 获取蓝牙适配器')
      }),
    },
  }
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
      writeType: 'write',
    })

    expect(fakeUni.openBluetoothAdapter).toHaveBeenCalledOnce()
    expect(fakeUni.writeBLECharacteristicValue).toHaveBeenCalledOnce()
    expect([...new Uint8Array(fakeUni.lastWrite.value)]).toEqual([77, 83, 70])
    expect(fakeUni.lastWrite.writeType).toBe('write')
  })

  it('forwards writeNoResponse to the native BLE API', async () => {
    const fakeUni = createFakeUni()
    const service = createBluetoothService(fakeUni)

    await service.write({
      deviceId: 'D1',
      serviceId: 'FFF0',
      characteristicId: 'C1',
      value: 'MSF',
      writeType: 'writeNoResponse',
    })

    expect(fakeUni.lastWrite.writeType).toBe('writeNoResponse')
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

  it('reads Android paired devices directly from the default Bluetooth adapter', async () => {
    const service = createBluetoothService(createFakeUni(), createFakePlus())

    expect(typeof service.getBonded).toBe('function')
    await expect(service.getBonded()).resolves.toEqual({
      devices: [
        {
          deviceId: '11:22:33:44:55:66',
          name: 'Headphones',
          localName: 'Headphones',
          bonded: true,
        },
        {
          deviceId: 'AA:BB:CC:DD:EE:FF',
          name: 'RM0-LOCK',
          localName: 'RM0-LOCK',
          bonded: true,
        },
      ],
    })
  })
})
