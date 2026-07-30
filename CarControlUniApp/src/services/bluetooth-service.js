import { stringToArrayBuffer } from '../utils/ble-data.js'

const call = (api, method, options = {}) => new Promise((resolve, reject) => {
  api[method]({ ...options, success: resolve, fail: reject })
})

function readAndroidBondedDevices(nativeRuntime) {
  if (!nativeRuntime?.android) return []

  const { android } = nativeRuntime
  const BluetoothAdapter = android.importClass('android.bluetooth.BluetoothAdapter')
  const adapter = BluetoothAdapter.getDefaultAdapter()
  if (!adapter) return []
  android.importClass(adapter)
  const bondedDevices = adapter.getBondedDevices()
  if (!bondedDevices) return []
  android.importClass(bondedDevices)
  const iterator = bondedDevices.iterator()
  android.importClass(iterator)

  const devices = []
  while (iterator.hasNext()) {
    const device = iterator.next()
    android.importClass(device)
    const name = device.getName() ?? ''
    devices.push({
      deviceId: device.getAddress(),
      name,
      localName: name,
      bonded: true,
    })
  }
  return devices
}

export function createBluetoothService(api = uni, nativeRuntime = globalThis.plus) {
  const foundListeners = new Set()
  const connectionListeners = new Set()
  const foundHandler = (result) => {
    foundListeners.forEach((listener) => listener(result.devices ?? []))
  }
  const connectionHandler = (result) => {
    connectionListeners.forEach((listener) => listener(result))
  }

  api.onBluetoothDeviceFound(foundHandler)
  api.onBLEConnectionStateChange(connectionHandler)

  return {
    open: () => call(api, 'openBluetoothAdapter'),
    getConnected: (services = ['FFF0']) => call(api, 'getConnectedBluetoothDevices', { services }),
    getBonded: async () => ({ devices: readAndroidBondedDevices(nativeRuntime) }),
    startScan: () => call(api, 'startBluetoothDevicesDiscovery', { allowDuplicatesKey: false }),
    stopScan: () => call(api, 'stopBluetoothDevicesDiscovery'),
    connect: (deviceId) => call(api, 'createBLEConnection', { deviceId, timeout: 10000 }),
    disconnect: (deviceId) => call(api, 'closeBLEConnection', { deviceId }),
    getServices: (deviceId) => call(api, 'getBLEDeviceServices', { deviceId }),
    getCharacteristics: (deviceId, serviceId) => call(api, 'getBLEDeviceCharacteristics', {
      deviceId,
      serviceId,
    }),
    write: ({ deviceId, serviceId, characteristicId, value, writeType }) => call(
      api,
      'writeBLECharacteristicValue',
      { deviceId, serviceId, characteristicId, value: stringToArrayBuffer(value), writeType },
    ),
    onDeviceFound(listener) {
      foundListeners.add(listener)
      return () => foundListeners.delete(listener)
    },
    onConnectionChange(listener) {
      connectionListeners.add(listener)
      return () => connectionListeners.delete(listener)
    },
    dispose() {
      api.offBluetoothDeviceFound(foundHandler)
      api.offBLEConnectionStateChange(connectionHandler)
      foundListeners.clear()
      connectionListeners.clear()
    },
  }
}
