import { describe, expect, it, vi } from 'vitest'
import {
  androidBluetoothPermissions,
  requestAndroidBluetoothPermissions,
} from '../src/services/android-bluetooth-permissions.js'

describe('Android Bluetooth permissions', () => {
  it('requests nearby-device permissions on Android 12 and newer', () => {
    expect(androidBluetoothPermissions(36)).toEqual([
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.BLUETOOTH_CONNECT',
    ])
  })

  it('requests location permission on older Android versions', () => {
    expect(androidBluetoothPermissions(30)).toEqual([
      'android.permission.ACCESS_FINE_LOCATION',
    ])
  })

  it('reports whether every required permission was granted', async () => {
    const requestPermissions = vi.fn((permissions, success) => {
      success({
        granted: permissions,
        deniedPresent: [],
        deniedAlways: [],
      })
    })
    const runtime = { android: { requestPermissions } }

    await expect(requestAndroidBluetoothPermissions(runtime, 36)).resolves.toEqual({
      granted: true,
      deniedAlways: false,
    })
    expect(requestPermissions).toHaveBeenCalledWith(
      [
        'android.permission.BLUETOOTH_SCAN',
        'android.permission.BLUETOOTH_CONNECT',
      ],
      expect.any(Function),
      expect.any(Function),
    )
  })

  it('blocks Bluetooth startup when a permission is denied permanently', async () => {
    const runtime = {
      android: {
        requestPermissions: (_permissions, success) => success({
          granted: [],
          deniedPresent: [],
          deniedAlways: ['android.permission.BLUETOOTH_SCAN'],
        }),
      },
    }

    await expect(requestAndroidBluetoothPermissions(runtime, 36)).resolves.toEqual({
      granted: false,
      deniedAlways: true,
    })
  })
})
