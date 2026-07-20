// @vitest-environment jsdom

import { createApp, h, nextTick, reactive } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import VehicleControlButton from '../src/components/VehicleControlButton.vue'

const mountedApps = []

function mountButton(overrides = {}) {
  const props = reactive({
    command: { key: 'trunk', title: '尾箱', icon: 'T' },
    connected: false,
    enabled: false,
    busy: false,
    ...overrides,
  })
  const commands = []
  const host = document.createElement('div')
  document.body.append(host)

  const app = createApp({
    setup() {
      return () => h(VehicleControlButton, {
        ...props,
        onCommand: (key) => commands.push(key),
      })
    },
  })
  app.mount(host)
  mountedApps.push({ app, host })

  return {
    button: () => host.querySelector('button'),
    commands,
    props,
  }
}

afterEach(() => {
  for (const { app, host } of mountedApps.splice(0)) {
    app.unmount()
    host.remove()
  }
})

describe('VehicleControlButton', () => {
  it('does not emit when the actual button is unready', () => {
    const mounted = mountButton({ enabled: false })
    let dispatchedClicks = 0
    mounted.button().addEventListener('click', () => { dispatchedClicks += 1 })

    expect(mounted.button().disabled).toBe(true)
    expect(mounted.button().hasAttribute('disabled')).toBe(true)
    mounted.button().click()
    mounted.button().dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(dispatchedClicks).toBe(1)
    expect(mounted.commands).toEqual([])
  })

  it('does not emit while busy even if enabled', () => {
    const mounted = mountButton({ enabled: true, busy: true })

    expect(mounted.button().disabled).toBe(true)
    mounted.button().click()
    mounted.button().dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(mounted.commands).toEqual([])
  })

  it('keeps sending connected-looking with a visible lockout state', () => {
    const mounted = mountButton({ connected: true, enabled: false })

    expect(mounted.button().disabled).toBe(true)
    expect(mounted.button().classList.contains('control-button--connected')).toBe(true)
    expect(mounted.button().classList.contains('control-button--locked')).toBe(true)
    expect(mounted.button().classList.contains('busy')).toBe(false)
  })

  it('emits the exact command key from a ready button', () => {
    const mounted = mountButton({ enabled: true })

    expect(mounted.button().disabled).toBe(false)
    expect(mounted.button().hasAttribute('disabled')).toBe(false)
    mounted.button().click()

    expect(mounted.commands).toEqual(['trunk'])
  })

  it('updates the native disabled attribute with readiness and busy state', async () => {
    const mounted = mountButton()

    expect(mounted.button().hasAttribute('disabled')).toBe(true)

    mounted.props.enabled = true
    await nextTick()
    expect(mounted.button().hasAttribute('disabled')).toBe(false)

    mounted.props.busy = true
    await nextTick()
    expect(mounted.button().hasAttribute('disabled')).toBe(true)

    mounted.props.busy = false
    await nextTick()
    expect(mounted.button().hasAttribute('disabled')).toBe(false)
  })
})
