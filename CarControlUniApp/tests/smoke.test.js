import { describe, expect, it } from 'vitest'
import { APP_NAME } from '../src/domain/app-meta.js'

describe('project', () => {
  it('identifies the CarControl app', () => {
    expect(APP_NAME).toBe('CarControl')
  })
})
