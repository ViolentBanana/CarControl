import { stringToArrayBuffer } from '../utils/ble-data.js'

const call = (api, method, options = {}) => new Promise((resolve, reject) => {
  api[method]({ ...options, success: resolve, fail: reject })
})

export function createBluetoothService(api = uni) {
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
