import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parse } from 'jsonc-parser'
import { describe, expect, it } from 'vitest'

const manifestPath = fileURLToPath(new URL('../src/manifest.json', import.meta.url))

describe('platform configuration', () => {
  it('configures the App identity and Bluetooth module', () => {
    const manifest = parse(readFileSync(manifestPath, 'utf8'))

    expect(manifest.name).toBe('CarControl')
    expect(manifest.appid).toBe('')
    expect(manifest.versionName).toBe('1.0.0')
    expect(manifest.versionCode).toBe('100')
    expect(manifest['app-plus'].modules).toHaveProperty('Bluetooth')
  })

  it('registers the package, URL scheme, and iOS privacy copy', () => {
    const manifest = parse(readFileSync(manifestPath, 'utf8'))
    const { android, ios } = manifest['app-plus'].distribute

    expect(android.packagename).toBe('com.chen.carcontrol')
    expect(android.schemes).toBe('carcontrol')
    expect(ios.urltypes).toBe('carcontrol')
    expect(ios.deploymentTarget).toBe('12.0')
    expect(ios.privacyDescription.NSBluetoothAlwaysUsageDescription).toContain('RM3')
  })

  it('declares every Android permission required for BLE discovery and connection', () => {
    const manifest = parse(readFileSync(manifestPath, 'utf8'))
    const permissions = manifest['app-plus'].distribute.android.permissions.join('\n')

    for (const permission of [
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_ADMIN',
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.ACCESS_FINE_LOCATION',
    ]) {
      expect(permissions).toContain(permission)
    }
  })
})
