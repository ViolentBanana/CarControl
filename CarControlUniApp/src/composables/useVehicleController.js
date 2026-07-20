import { computed, ref } from 'vue'
import { createControlState } from '../domain/vehicle-control-state.js'
import { isTargetDevice, normalizeUuid } from '../utils/ble-data.js'

const SCAN_TIMEOUT_MS = 10000
const WRITE_TIMEOUT_MS = 3000
const RESULT_DURATION_MS = 2000

const defaultScheduler = {
  setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimeout: (timer) => globalThis.clearTimeout(timer),
}

export function createVehicleController(service, scheduler = defaultScheduler) {
  const state = ref(createControlState('disconnected'))
  const logs = ref([])
  const lastResult = ref(null)
  const isControllable = computed(() => state.value.phase === 'ready')

  let scanGeneration = 0
  let connectionGeneration = 0
  let writeToken = null
  let scanTimer = null
  let resultTimer = null
  let currentDevice = null
  let writableCharacteristic = null
  let disposed = false

  const log = (message) => {
    logs.value = [...logs.value.slice(-79), { message, timestamp: Date.now() }]
  }

  const clearTimer = (name) => {
    const timer = name === 'scan' ? scanTimer : resultTimer
    if (timer !== null) scheduler.clearTimeout(timer)
    if (name === 'scan') scanTimer = null
    else resultTimer = null
  }

  const stopScan = () => {
    clearTimer('scan')
    return service.stopScan().catch(() => {})
  }

  const fail = (message) => {
    writableCharacteristic = null
    state.value = createControlState('failure', { message })
    log(message)
  }

  const discover = async (device, generation) => {
    await stopScan()
    if (disposed || generation !== connectionGeneration) return

    currentDevice = device
    state.value = createControlState('connecting', { deviceName: device.name ?? device.localName ?? 'RM3' })
    log(`连接 ${device.name ?? device.localName ?? device.deviceId}`)

    try {
      await service.connect(device.deviceId)
      if (disposed || generation !== connectionGeneration) return

      state.value = createControlState('discovering', { deviceName: device.name ?? device.localName ?? 'RM3' })
      const serviceResult = await service.getServices(device.deviceId)
      if (disposed || generation !== connectionGeneration) return

      const targetService = (serviceResult.services ?? []).find(({ uuid }) => normalizeUuid(uuid) === 'FFF0')
      if (!targetService) {
        fail('目标车辆未提供 FFF0 服务')
        return
      }

      const characteristicResult = await service.getCharacteristics(device.deviceId, targetService.uuid)
      if (disposed || generation !== connectionGeneration) return

      const characteristic = (characteristicResult.characteristics ?? []).find(({ properties = {} }) => (
        properties.write || properties.writeNoResponse
      ))
      if (!characteristic) {
        fail('FFF0 服务没有可写特征')
        return
      }

      writableCharacteristic = {
        deviceId: device.deviceId,
        serviceId: targetService.uuid,
        characteristicId: characteristic.uuid,
      }
      state.value = createControlState('ready', { deviceName: device.name ?? device.localName ?? 'RM3' })
      log('RM3 控制通道已就绪')
    } catch (error) {
      if (!disposed && generation === connectionGeneration) {
        fail(error?.errMsg ?? error?.message ?? '连接车辆失败')
      }
    }
  }

  const foundUnsubscribe = service.onDeviceFound((devices) => {
    if (disposed || state.value.phase !== 'scanning') return
    const device = devices.find(isTargetDevice)
    if (!device) return
    const generation = connectionGeneration
    scanGeneration += 1
    void discover(device, generation)
  })

  const connectionUnsubscribe = service.onConnectionChange((result) => {
    if (disposed || result.connected || result.deviceId !== currentDevice?.deviceId) return
    scanGeneration += 1
    connectionGeneration += 1
    writeToken = null
    writableCharacteristic = null
    clearTimer('scan')
    clearTimer('result')
    state.value = createControlState('disconnected')
    log('车辆蓝牙连接已断开')
  })

  const connect = async () => {
    if (disposed) return false

    const ownScanGeneration = ++scanGeneration
    const ownConnectionGeneration = ++connectionGeneration
    writeToken = null
    writableCharacteristic = null
    clearTimer('scan')
    clearTimer('result')
    lastResult.value = null
    state.value = createControlState('scanning')
    log('初始化蓝牙并搜索 RM3')

    try {
      await service.open()
      if (disposed || ownScanGeneration !== scanGeneration) return false

      const connected = await service.getConnected(['FFF0'])
      if (disposed || ownScanGeneration !== scanGeneration) return false
      const knownDevice = (connected.devices ?? []).find(isTargetDevice)
      if (knownDevice) {
        await discover(knownDevice, ownConnectionGeneration)
        return state.value.phase === 'ready'
      }

      await service.startScan()
      if (disposed || ownScanGeneration !== scanGeneration) return false
      scanTimer = scheduler.setTimeout(() => {
        if (disposed || ownScanGeneration !== scanGeneration || state.value.phase !== 'scanning') return
        scanGeneration += 1
        void stopScan()
        fail('未发现 RM3，请确认车辆蓝牙已开启')
      }, SCAN_TIMEOUT_MS)
      return true
    } catch (error) {
      if (!disposed && ownScanGeneration === scanGeneration) {
        const message = error?.errCode === 10001
          ? '蓝牙未开启'
          : (error?.errMsg ?? error?.message ?? '蓝牙初始化失败')
        state.value = createControlState(error?.errCode === 10001 ? 'unavailable' : 'failure', { message })
        log(message)
      }
      return false
    }
  }

  const sendCommand = async (command) => {
    if (disposed || state.value.phase !== 'ready' || !writableCharacteristic) return false

    const token = Symbol(command.value)
    const generation = connectionGeneration
    writeToken = token
    clearTimer('result')
    state.value = createControlState('sending', {
      command: command.value,
      deviceName: currentDevice?.name ?? currentDevice?.localName ?? 'RM3',
    })
    log(`发送 ${command.value} · ${command.title}`)

    resultTimer = scheduler.setTimeout(() => {
      if (writeToken !== token || generation !== connectionGeneration) return
      writeToken = null
      writableCharacteristic = null
      connectionGeneration += 1
      scanGeneration += 1
      lastResult.value = { command: command.key, ok: false, message: '指令超时，请重新连接' }
      fail('指令超时，请重新连接')
      if (currentDevice) void service.disconnect(currentDevice.deviceId).catch(() => {})
    }, WRITE_TIMEOUT_MS)

    try {
      await service.write({ ...writableCharacteristic, value: command.value })
      if (disposed || writeToken !== token || generation !== connectionGeneration) return false

      writeToken = null
      clearTimer('result')
      state.value = createControlState('ready', {
        deviceName: currentDevice?.name ?? currentDevice?.localName ?? 'RM3',
      })
      lastResult.value = { command: command.key, ok: true, message: `${command.title}指令已发送` }
      log(`${command.value} 发送成功`)
      resultTimer = scheduler.setTimeout(() => {
        lastResult.value = null
        resultTimer = null
      }, RESULT_DURATION_MS)
      return true
    } catch (error) {
      if (disposed || writeToken !== token || generation !== connectionGeneration) return false
      writeToken = null
      clearTimer('result')
      const message = error?.errMsg ?? error?.message ?? '指令发送失败'
      lastResult.value = { command: command.key, ok: false, message }
      state.value = createControlState('ready', {
        deviceName: currentDevice?.name ?? currentDevice?.localName ?? 'RM3',
      })
      log(message)
      resultTimer = scheduler.setTimeout(() => {
        lastResult.value = null
        resultTimer = null
      }, RESULT_DURATION_MS)
      return false
    }
  }

  const dispose = () => {
    if (disposed) return
    disposed = true
    scanGeneration += 1
    connectionGeneration += 1
    writeToken = null
    writableCharacteristic = null
    clearTimer('scan')
    clearTimer('result')
    foundUnsubscribe()
    connectionUnsubscribe()
    void service.stopScan().catch(() => {})
    if (currentDevice) void service.disconnect(currentDevice.deviceId).catch(() => {})
    service.dispose()
  }

  return {
    state,
    logs,
    lastResult,
    isControllable,
    connect,
    retry: connect,
    sendCommand,
    dispose,
  }
}
