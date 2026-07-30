import { describe, expect, it, vi } from 'vitest'
import { VehicleCommand } from '../src/domain/vehicle-command.js'
import { createVehicleController } from '../src/composables/useVehicleController.js'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function createScheduler() {
  let nextId = 1
  const timers = new Map()
  return {
    setTimeout: vi.fn((callback) => {
      const id = nextId++
      timers.set(id, callback)
      return id
    }),
    clearTimeout: vi.fn((id) => timers.delete(id)),
    run(id) {
      const callback = timers.get(id)
      timers.delete(id)
      callback?.()
    },
    runAll() {
      for (const id of [...timers.keys()]) this.run(id)
    },
    get ids() { return [...timers.keys()] },
  }
}

function createFakeService(overrides = {}) {
  let foundListener
  let connectionListener
  const service = {
    open: vi.fn().mockResolvedValue({}),
    getConnected: vi.fn().mockResolvedValue({ devices: [] }),
    getBonded: vi.fn().mockResolvedValue({ devices: [] }),
    startScan: vi.fn().mockResolvedValue({}),
    stopScan: vi.fn().mockResolvedValue({}),
    connect: vi.fn().mockResolvedValue({}),
    disconnect: vi.fn().mockResolvedValue({}),
    getServices: vi.fn().mockResolvedValue({
      services: [{ uuid: '0000FFF0-0000-1000-8000-00805F9B34FB' }],
    }),
    getCharacteristics: vi.fn().mockResolvedValue({
      characteristics: [{ uuid: 'C1', properties: { write: true } }],
    }),
    write: vi.fn().mockResolvedValue({}),
    foundUnsubscribe: vi.fn(),
    connectionUnsubscribe: vi.fn(),
    onDeviceFound: vi.fn((listener) => {
      foundListener = listener
      return service.foundUnsubscribe
    }),
    onConnectionChange: vi.fn((listener) => {
      connectionListener = listener
      return service.connectionUnsubscribe
    }),
    dispose: vi.fn(),
    emitFound(devices) { foundListener(devices) },
    emitConnection(result) { connectionListener(result) },
    ...overrides,
  }
  return service
}

async function becomeReady(controller, service) {
  await controller.connect()
  service.emitFound([{ deviceId: 'D1', name: 'RM3-Q60' }])
  await flush()
  await flush()
}

describe('vehicle controller', () => {
  it('restores an already-connected FFF0 device without filtering its name', async () => {
    const service = createFakeService({
      getConnected: vi.fn().mockResolvedValue({
        devices: [{ deviceId: 'LOCK', name: 'RM0-LOCK' }],
      }),
    })
    const controller = createVehicleController(service, createScheduler())

    expect(await controller.connect()).toBe(true)
    expect(service.connect).toHaveBeenCalledWith('LOCK')
    expect(controller.state.value).toMatchObject({
      phase: 'ready',
      deviceName: 'RM0-LOCK',
    })
  })

  it('connects the system-paired RM0 by address when no FFF0 device is returned', async () => {
    const service = createFakeService({
      getBonded: vi.fn().mockResolvedValue({
        devices: [
          {
            deviceId: 'AA:BB:CC:DD:EE:FF',
            name: 'RM0-LOCK',
            localName: 'RM0-LOCK',
            bonded: true,
          },
        ],
      }),
    })
    const controller = createVehicleController(service, createScheduler())

    expect(await controller.connect()).toBe(true)
    expect(controller.state.value).toMatchObject({
      phase: 'ready',
      deviceName: 'RM0-LOCK',
    })
    expect(service.connect).toHaveBeenCalledWith('AA:BB:CC:DD:EE:FF')
    expect(service.startScan).not.toHaveBeenCalled()
  })

  it('continues BLE scanning when reading Android paired devices fails', async () => {
    const service = createFakeService({
      getBonded: vi.fn().mockRejectedValue(new Error('读取系统配对列表失败')),
    })
    const controller = createVehicleController(service, createScheduler())

    expect(await controller.connect()).toBe(true)
    expect(controller.state.value.phase).toBe('scanning')
    expect(service.startScan).toHaveBeenCalledOnce()
    expect(controller.logs.value.map(({ message }) => message)).toContain(
      '读取系统配对设备失败：读取系统配对列表失败，继续扫描',
    )
  })

  it('starts scanning when the connected-device query does not return', async () => {
    const pendingConnectedQuery = deferred()
    const service = createFakeService({
      getConnected: vi.fn(() => pendingConnectedQuery.promise),
    })
    const scheduler = createScheduler()
    const controller = createVehicleController(service, scheduler)

    const connecting = controller.connect()
    await flush()
    scheduler.run(scheduler.ids[0])

    expect(await connecting).toBe(true)
    expect(service.startScan).toHaveBeenCalledOnce()
    expect(controller.state.value.phase).toBe('scanning')
  })

  it('connects a scanned RM0 device when it exposes the control service', async () => {
    const service = createFakeService()
    const controller = createVehicleController(service, createScheduler())

    await controller.connect()
    service.emitFound([{ deviceId: 'LOCK', name: 'RM0-LOCK' }])
    await flush()
    await flush()

    expect(controller.state.value).toMatchObject({
      phase: 'ready',
      deviceName: 'RM0-LOCK',
    })
  })

  it('keeps scanning after a candidate lacks FFF0 and connects the next valid device', async () => {
    const service = createFakeService({
      getServices: vi.fn()
        .mockResolvedValueOnce({ services: [{ uuid: '1812' }] })
        .mockResolvedValueOnce({
          services: [{ uuid: '0000FFF0-0000-1000-8000-00805F9B34FB' }],
        }),
    })
    const controller = createVehicleController(service, createScheduler())

    await controller.connect()
    service.emitFound([{ deviceId: 'LOCK', name: 'RM0-LOCK' }])
    await flush()
    await flush()
    expect(controller.state.value.phase).toBe('scanning')

    service.emitFound([{ deviceId: 'KEY', name: 'RM3-BleKEY' }])
    await flush()
    await flush()

    expect(controller.state.value).toMatchObject({
      phase: 'ready',
      deviceName: 'RM3-BleKEY',
    })
  })

  it('cancels and settles a pending connected-device query on dispose', async () => {
    const pendingConnectedQuery = deferred()
    const service = createFakeService({
      getConnected: vi.fn(() => pendingConnectedQuery.promise),
    })
    const scheduler = createScheduler()
    const controller = createVehicleController(service, scheduler)

    const connecting = controller.connect()
    await flush()
    const queryTimer = scheduler.ids[0]
    controller.dispose()

    expect(scheduler.clearTimeout).toHaveBeenCalledWith(queryTimer)
    expect(await connecting).toBe(false)
  })

  it('clears the connected-device timeout when the native query rejects', async () => {
    const service = createFakeService({
      getConnected: vi.fn().mockRejectedValue(new Error('系统查询失败')),
    })
    const scheduler = createScheduler()
    const controller = createVehicleController(service, scheduler)

    expect(await controller.connect()).toBe(false)
    scheduler.runAll()

    expect(scheduler.clearTimeout).toHaveBeenCalled()
    expect(controller.logs.value.map(({ message }) => message)).not.toContain(
      '查询已连接设备超时，继续扫描',
    )
  })

  it('ignores unrelated devices', async () => {
    const service = createFakeService()
    const controller = createVehicleController(service, createScheduler())

    await controller.connect()
    service.emitFound([{ deviceId: 'D2', name: 'Headphones' }])
    await flush()

    expect(controller.state.value.phase).toBe('scanning')
    expect(service.connect).not.toHaveBeenCalled()
  })

  it('keeps controls disabled and resumes scanning when FFF0 is not writable', async () => {
    const service = createFakeService({
      getCharacteristics: vi.fn().mockResolvedValue({
        characteristics: [{ uuid: 'C1', properties: { read: true } }],
      }),
    })
    const controller = createVehicleController(service, createScheduler())

    await controller.connect()
    service.emitFound([{ deviceId: 'D1', name: 'RM3-Q60' }])
    await flush()
    await flush()

    expect(controller.state.value.phase).toBe('scanning')
    expect(controller.isControllable.value).toBe(false)
  })

  it('prefers write when a control characteristic supports both write modes', async () => {
    const pendingWrite = deferred()
    const service = createFakeService({
      getCharacteristics: vi.fn().mockResolvedValue({
        characteristics: [{ uuid: 'C1', properties: { write: true, writeNoResponse: true } }],
      }),
      write: vi.fn(() => pendingWrite.promise),
    })
    const controller = createVehicleController(service, createScheduler())
    await becomeReady(controller, service)

    const first = controller.sendCommand(VehicleCommand.lock)
    const duplicate = await controller.sendCommand(VehicleCommand.lock)

    expect(controller.state.value.phase).toBe('sending')
    expect(duplicate).toBe(false)
    expect(service.write).toHaveBeenCalledTimes(1)
    expect(service.write).toHaveBeenCalledWith(expect.objectContaining({
      value: 'MSF',
      writeType: 'write',
    }))

    pendingWrite.resolve({})
    expect(await first).toBe(true)
    expect(controller.state.value.phase).toBe('ready')
    expect(controller.lastResult.value).toMatchObject({ command: 'lock', ok: true })
  })

  it('uses writeNoResponse for a control characteristic that only supports it', async () => {
    const service = createFakeService({
      getCharacteristics: vi.fn().mockResolvedValue({
        characteristics: [{ uuid: 'C1', properties: { writeNoResponse: true } }],
      }),
    })
    const controller = createVehicleController(service, createScheduler())
    await becomeReady(controller, service)

    expect(await controller.sendCommand(VehicleCommand.lock)).toBe(true)
    expect(service.write).toHaveBeenCalledWith(expect.objectContaining({
      value: 'MSF',
      writeType: 'writeNoResponse',
    }))
  })

  it('ignores stale scan and connection generations', async () => {
    const firstOpen = deferred()
    const oldConnection = deferred()
    const service = createFakeService({
      open: vi.fn()
        .mockImplementationOnce(() => firstOpen.promise)
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({}),
      connect: vi.fn(() => oldConnection.promise),
    })
    const controller = createVehicleController(service, createScheduler())

    const staleScan = controller.connect()
    await controller.connect()
    firstOpen.resolve({})
    await staleScan
    expect(service.getConnected).toHaveBeenCalledTimes(1)

    service.emitFound([{ deviceId: 'OLD', name: 'RM3-OLD' }])
    await flush()
    await controller.retry()
    oldConnection.resolve({})
    await flush()

    expect(controller.state.value.phase).toBe('scanning')
    expect(service.getServices).not.toHaveBeenCalled()
    expect(service.disconnect).toHaveBeenCalledWith('OLD')
  })

  it('disables controls immediately after disconnect', async () => {
    const service = createFakeService()
    const controller = createVehicleController(service, createScheduler())
    await becomeReady(controller, service)

    service.emitConnection({ deviceId: 'D1', connected: false })

    expect(controller.state.value.phase).toBe('disconnected')
    expect(controller.isControllable.value).toBe(false)
  })

  it('retries immediately after a remote disconnect without closing the dead connection again', async () => {
    const neverDisconnects = deferred()
    const service = createFakeService({
      disconnect: vi.fn(() => neverDisconnects.promise),
    })
    const controller = createVehicleController(service, createScheduler())
    await becomeReady(controller, service)

    service.emitConnection({ deviceId: 'D1', connected: false })
    void controller.retry()
    await flush()

    expect(service.disconnect).not.toHaveBeenCalled()
    expect(service.open).toHaveBeenCalledTimes(2)
    expect(controller.state.value.phase).toBe('scanning')
  })

  it('clears listeners and timers on dispose', async () => {
    const service = createFakeService()
    const scheduler = createScheduler()
    const controller = createVehicleController(service, scheduler)
    await controller.connect()

    controller.dispose()

    expect(service.foundUnsubscribe).toHaveBeenCalledOnce()
    expect(service.connectionUnsubscribe).toHaveBeenCalledOnce()
    expect(service.stopScan).toHaveBeenCalled()
    expect(service.dispose).toHaveBeenCalledOnce()
    expect(scheduler.clearTimeout).toHaveBeenCalled()
  })
})
