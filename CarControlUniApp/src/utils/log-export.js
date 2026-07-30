const pad = (value) => String(value).padStart(2, '0')

export function formatLogLines(lines = []) {
  return lines.map(({ timestamp, message }) => {
    const date = new Date(timestamp)
    const time = [date.getHours(), date.getMinutes(), date.getSeconds()].map(pad).join(':')
    return `${time} ${message}`
  }).join('\n')
}
