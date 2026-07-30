export function androidBluetoothPermissions(apiLevel) {
  if (Number(apiLevel) >= 31) {
    return [
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.ACCESS_FINE_LOCATION',
    ]
  }
  return ['android.permission.ACCESS_FINE_LOCATION']
}

export function androidApiLevel(runtime, fallbackApiLevel) {
  const fallback = Number(fallbackApiLevel)
  if (Number.isFinite(fallback) && fallback > 0) return fallback

  try {
    const Version = runtime.android.importClass('android.os.Build$VERSION')
    const nativeApiLevel = Number(Version.SDK_INT)
    if (Number.isFinite(nativeApiLevel) && nativeApiLevel > 0) return nativeApiLevel
  }
  catch {
    // If native version detection fails, request the modern permission set.
  }

  return 31
}

export function requestAndroidBluetoothPermissions(runtime, apiLevel) {
  const permissions = androidBluetoothPermissions(androidApiLevel(runtime, apiLevel))
  return new Promise((resolve, reject) => {
    runtime.android.requestPermissions(
      permissions,
      ({ granted = [], deniedPresent = [], deniedAlways = [] }) => {
        resolve({
          granted: deniedPresent.length === 0
            && deniedAlways.length === 0
            && permissions.every((permission) => granted.includes(permission)),
          deniedAlways: deniedAlways.length > 0,
        })
      },
      reject,
    )
  })
}
