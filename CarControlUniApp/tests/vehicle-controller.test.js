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
  it('ignores non-RM3 devices', async () => {
    const service = createFakeService()
    const controller = createVehicleController(service, createScheduler())

    await controller.connect()
    service.emitFound([{ deviceId: 'D2', name: 'Headphones' }])
    await flush()

    expect(controller.state.value.phase).toBe('scanning')
    expect(service.connect).not.toHaveBeenCalled()
  })

  it('becomes ready only after FFF0 exposes write or writeNoResponse', async () => {
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

    expect(controller.state.value.phase).toBe('failure')
    expect(controller.isControllable.value).toBe(false)
  })

  it('sends MSF once and blocks a duplicate while sending', async () => {
    const pendingWrite = deferred()
    const service = createFakeService({ write: vi.fn(() => pendingWrite.promise) })
    const controller = createVehicleController(service, createScheduler())
    await becomeReady(controller, service)

    const first = controller.sendCommand(VehicleCommand.lock)
    const duplicate = await controller.sendCommand(VehicleCommand.lock)

    expect(controller.state.value.phase).toBe('sending')
    expect(duplicate).toBe(false)
    expect(service.write).toHaveBeenCalledTimes(1)
    expect(service.write).toHaveBeenCalledWith(expect.objectContaining({ value: 'MSF' }))

    pendingWrite.resolve({})
    expect(await first).toBe(true)
    expect(controller.state.value.phase).toBe('ready')
    expect(controller.lastResult.value).toMatchObject({ command: 'lock', ok: true })
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
  })

  it('disables controls immediately after disconnect', async () => {
    const service = createFakeService()
    const controller = createVehicleController(service, createScheduler())
    await becomeReady(controller, service)

    service.emitConnection({ deviceId: 'D1', connected: false })

    expect(controller.state.value.phase).toBe('disconnected')
    expect(controller.isControllable.value).toBe(false)
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
