export function androidBluetoothPermissions(apiLevel) {
  if (Number(apiLevel) >= 31) {
    return [
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.BLUETOOTH_CONNECT',
    ]
  }
  return ['android.permission.ACCESS_FINE_LOCATION']
}

export function requestAndroidBluetoothPermissions(runtime, apiLevel) {
  const permissions = androidBluetoothPermissions(apiLevel)
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
