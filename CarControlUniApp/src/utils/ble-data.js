export function normalizeUuid(value = '') {
  const upper = value.toUpperCase()
  const match = upper.match(/^0000([0-9A-F]{4})-0000-1000-8000-00805F9B34FB$/)
  return match ? match[1] : upper
}

export function isTargetDevice(device) {
  const name = (device?.name ?? device?.localName ?? '').toUpperCase()
  return name.includes('RM0') || name.includes('RM3')
}

export function stringToArrayBuffer(value) {
  return new TextEncoder().encode(value).buffer
}
