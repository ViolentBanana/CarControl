import { computed, ref } from 'vue'
import { createControlState } from '../domain/vehicle-control-state.js'
import { isTargetDevice, normalizeUuid } from '../utils/ble-data.js'

const SCAN_TIMEOUT_MS = 10000
const CONNECTED_QUERY_TIMEOUT_MS = 1500
const WRITE_TIMEOUT_MS = 3000
const RESULT_DURATION_MS = 2000

const defaultScheduler = {
  setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimeout: (timer) => globalThis.clearTimeout(timer),
}

const deviceDescription = (device = {}) => [
  `name=${device.name ?? '-'}`,
  `localName=${device.localName ?? '-'}`,
  `deviceId=${device.deviceId ?? '-'}`,
  `RSSI=${device.RSSI ?? '-'}`,
  `services=${(device.advertisServiceUUIDs ?? []).join(',') || '-'}`,
].join(' | ')

const errorDescription = (error = {}) => [
  error.errCode === undefined ? null : `errCode=${error.errCode}`,
  error.errMsg ?? error.message ?? String(error),
].filter(Boolean).join(' | ')

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
  let cancelActiveConnectedQuery = null
  let currentDevice = null
  let writableCharacteristic = null
  let disposed = false
  const rejectedDeviceIds = new Set()

  const log = (message) => {
    console.log(`[BLE] ${message}`)
    logs.value = [...logs.value, { message, timestamp: Date.now() }]
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

  const cancelConnectedQuery = () => {
    const cancel = cancelActiveConnectedQuery
    cancelActiveConnectedQuery = null
    cancel?.()
  }

  const fail = (message) => {
    writableCharacteristic = null
    state.value = createControlState('failure', { message })
    log(message)
  }

  const beginScan = async (generation) => {
    await service.startScan()
    if (disposed || generation !== scanGeneration) return false
    log('BLE 扫描已启动')
    scanTimer = scheduler.setTimeout(() => {
      if (disposed || generation !== scanGeneration || state.value.phase !== 'scanning') return
      scanGeneration += 1
      void stopScan()
      fail('未发现车辆蓝牙，请确认 RM0-LOCK 已连接')
    }, SCAN_TIMEOUT_MS)
    return true
  }

  const resumeAfterRejectedCandidate = async (device, generation, message) => {
    rejectedDeviceIds.add(device.deviceId)
    if (currentDevice?.deviceId === device.deviceId) currentDevice = null
    await service.disconnect(device.deviceId).catch(() => {})
    log(`已断开候选设备：${deviceDescription(device)}`)
    if (disposed || generation !== connectionGeneration) return

    writableCharacteristic = null
    state.value = createControlState('scanning')
    log(`${message}，继续扫描其他车辆设备`)
    const nextScanGeneration = ++scanGeneration
    try {
      await beginScan(nextScanGeneration)
    } catch (error) {
      if (!disposed && generation === connectionGeneration) {
        fail(error?.errMsg ?? error?.message ?? '重新扫描车辆蓝牙失败')
      }
    }
  }

  const discover = async (device, generation, resumeOnFailure = false) => {
    await stopScan()
    if (disposed || generation !== connectionGeneration) return

    currentDevice = device
    state.value = createControlState('connecting', { deviceName: device.name ?? device.localName ?? '车辆蓝牙' })
    log(`开始连接：${deviceDescription(device)}`)

    try {
      await service.connect(device.deviceId)
      if (disposed || generation !== connectionGeneration) {
        await service.disconnect(device.deviceId).catch(() => {})
        return
      }
      log(`连接 API 成功：${deviceDescription(device)}`)

      state.value = createControlState('discovering', { deviceName: device.name ?? device.localName ?? '车辆蓝牙' })
      const serviceResult = await service.getServices(device.deviceId)
      if (disposed || generation !== connectionGeneration) return
      const services = serviceResult.services ?? []
      log(`全部 Service（${services.length}）：${services.map(({ uuid }) => uuid).join('、') || '无'}`)

      const targetService = services.find(({ uuid }) => normalizeUuid(uuid) === 'FFF0')
      if (!targetService) {
        if (resumeOnFailure) {
          await resumeAfterRejectedCandidate(device, generation, '候选设备未提供 FFF0 服务')
        } else {
          fail('目标车辆未提供 FFF0 服务')
        }
        return
      }

      const characteristicResult = await service.getCharacteristics(device.deviceId, targetService.uuid)
      if (disposed || generation !== connectionGeneration) return
      const characteristics = characteristicResult.characteristics ?? []
      for (const item of characteristics) {
        const properties = Object.entries(item.properties ?? {})
          .filter(([, enabled]) => enabled)
          .map(([name]) => name)
        log(`Characteristic：uuid=${item.uuid} | properties=${properties.join(',') || '无'}`)
      }

      const characteristic = characteristics.find(({ properties = {} }) => (
        properties.write || properties.writeNoResponse
      ))
      if (!characteristic) {
        if (resumeOnFailure) {
          await resumeAfterRejectedCandidate(device, generation, '候选设备的 FFF0 没有可写特征')
        } else {
          fail('FFF0 服务没有可写特征')
        }
        return
      }

      writableCharacteristic = {
        deviceId: device.deviceId,
        serviceId: targetService.uuid,
        characteristicId: characteristic.uuid,
        writeType: characteristic.properties.write ? 'write' : 'writeNoResponse',
      }
      state.value = createControlState('ready', { deviceName: device.name ?? device.localName ?? '车辆蓝牙' })
      log(`${state.value.deviceName} 控制通道已就绪（${writableCharacteristic.writeType}）`)
    } catch (error) {
      if (!disposed && generation === connectionGeneration) {
        const message = error?.errMsg ?? error?.message ?? '连接车辆失败'
        log(`连接流程错误：${errorDescription(error)}`)
        if (resumeOnFailure) {
          await resumeAfterRejectedCandidate(device, generation, message)
        } else {
          fail(message)
        }
      }
    }
  }

  const foundUnsubscribe = service.onDeviceFound((devices) => {
    if (disposed || state.value.phase !== 'scanning') return
    for (const device of devices) log(`扫描发现：${deviceDescription(device)}`)
    const device = devices.find((candidate) => (
      isTargetDevice(candidate) && !rejectedDeviceIds.has(candidate.deviceId)
    ))
    if (!device) return
    const generation = connectionGeneration
    scanGeneration += 1
    state.value = createControlState('connecting', {
      deviceName: device.name ?? device.localName ?? '车辆蓝牙',
    })
    void discover(device, generation, true)
  })

  const connectionUnsubscribe = service.onConnectionChange((result) => {
    log(`连接状态：deviceId=${result.deviceId ?? '-'} | connected=${Boolean(result.connected)}`)
    if (disposed || result.connected || result.deviceId !== currentDevice?.deviceId) return
    scanGeneration += 1
    connectionGeneration += 1
    writeToken = null
    writableCharacteristic = null
    currentDevice = null
    clearTimer('scan')
    clearTimer('result')
    state.value = createControlState('disconnected')
    log('车辆蓝牙连接已断开')
  })

  const connect = async () => {
    if (disposed) return false

    const ownScanGeneration = ++scanGeneration
    const ownConnectionGeneration = ++connectionGeneration
    cancelConnectedQuery()
    writeToken = null
    writableCharacteristic = null
    rejectedDeviceIds.clear()
    clearTimer('scan')
    clearTimer('result')
    lastResult.value = null
    state.value = createControlState('scanning')
    log('初始化车辆蓝牙连接')

    const previousDevice = currentDevice
    currentDevice = null
    if (previousDevice) await service.disconnect(previousDevice.deviceId).catch(() => {})
    if (disposed || ownScanGeneration !== scanGeneration) return false

    try {
      await service.open()
      if (disposed || ownScanGeneration !== scanGeneration) return false
      log('蓝牙适配器已就绪')

      log('检查系统已连接的 FFF0 设备')
      let queryTimer = null
      let resolveQueryTimeout = null
      const cancelQuery = () => {
        if (queryTimer !== null) scheduler.clearTimeout(queryTimer)
        queryTimer = null
        const resolve = resolveQueryTimeout
        resolveQueryTimeout = null
        resolve?.({ devices: [] })
      }
      cancelActiveConnectedQuery = cancelQuery
      let connected
      try {
        connected = await Promise.race([
          service.getConnected(['FFF0']),
          new Promise((resolve) => {
            resolveQueryTimeout = resolve
            queryTimer = scheduler.setTimeout(() => {
              queryTimer = null
              resolveQueryTimeout = null
              if (!disposed && ownScanGeneration === scanGeneration) {
                log('查询已连接设备超时，继续扫描')
              }
              resolve({ devices: [] })
            }, CONNECTED_QUERY_TIMEOUT_MS)
          }),
        ])
      } finally {
        if (queryTimer !== null) scheduler.clearTimeout(queryTimer)
        queryTimer = null
        resolveQueryTimeout = null
        if (cancelActiveConnectedQuery === cancelQuery) cancelActiveConnectedQuery = null
      }
      if (disposed || ownScanGeneration !== scanGeneration) return false
      const connectedDevices = connected.devices ?? []
      if (connectedDevices.length === 0) {
        log('系统返回已连接 FFF0 设备：0 台')
      } else {
        for (const device of connectedDevices) log(`系统已连接：${deviceDescription(device)}`)
      }
      const knownDevice = connectedDevices[0]
      if (knownDevice) {
        await discover(knownDevice, ownConnectionGeneration, true)
        return state.value.phase === 'ready'
      }

      log('检查系统已配对的 RM0-LOCK')
      let bondedDevices = []
      try {
        const bonded = await service.getBonded()
        bondedDevices = bonded.devices ?? []
        for (const device of bondedDevices) log(`系统已配对：${deviceDescription(device)}`)
      } catch (error) {
        log(`读取系统配对设备失败：${errorDescription(error) || '未知错误'}，继续扫描`)
      }
      if (disposed || ownScanGeneration !== scanGeneration) return false

      const bondedRm0 = bondedDevices.find((device) => (
        (device.name ?? device.localName ?? '').toUpperCase().includes('RM0')
      ))
      if (bondedRm0) {
        log(`使用系统配对 RM0 建立 FFF0 连接：${deviceDescription(bondedRm0)}`)
        await discover(bondedRm0, ownConnectionGeneration, true)
        return state.value.phase === 'ready'
      }

      log('未找到已连接 FFF0，开始扫描 BLE 设备')
      return beginScan(ownScanGeneration)
    } catch (error) {
      if (!disposed && ownScanGeneration === scanGeneration) {
        const message = error?.errCode === 10001
          ? '蓝牙未开启'
          : (error?.errMsg ?? error?.message ?? '蓝牙初始化失败')
        state.value = createControlState(error?.errCode === 10001 ? 'unavailable' : 'failure', { message })
        log(`蓝牙初始化错误：${errorDescription(error) || message}`)
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
      deviceName: currentDevice?.name ?? currentDevice?.localName ?? '车辆蓝牙',
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
        deviceName: currentDevice?.name ?? currentDevice?.localName ?? '车辆蓝牙',
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
        deviceName: currentDevice?.name ?? currentDevice?.localName ?? '车辆蓝牙',
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
    cancelConnectedQuery()
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
