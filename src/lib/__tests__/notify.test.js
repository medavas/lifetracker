import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { notifyPermission, requestNotifyPermission, fireNotification } from '../notify.js'

const clean = () => {
  delete globalThis.Notification
  delete globalThis.__swRegistration
}

/** Minimal Notification stand-in; the node test env has no DOM. */
const stubNotification = (permission, { onConstruct } = {}) => {
  const ctor = function (title, options) {
    onConstruct?.(title, options)
  }
  ctor.permission = permission
  ctor.requestPermission = vi.fn().mockResolvedValue('granted')
  globalThis.Notification = ctor
  return ctor
}

describe('notifyPermission', () => {
  beforeEach(clean)
  afterEach(clean)

  it('reports unsupported when the API is absent', () => {
    expect(notifyPermission()).toBe('unsupported')
  })

  it('reflects the current browser permission', () => {
    stubNotification('denied')
    expect(notifyPermission()).toBe('denied')
    stubNotification('granted')
    expect(notifyPermission()).toBe('granted')
  })
})

describe('requestNotifyPermission', () => {
  beforeEach(clean)
  afterEach(clean)

  it('resolves unsupported without throwing when the API is absent', async () => {
    await expect(requestNotifyPermission()).resolves.toBe('unsupported')
  })

  it('delegates to the browser when available', async () => {
    const ctor = stubNotification('default')
    await expect(requestNotifyPermission()).resolves.toBe('granted')
    expect(ctor.requestPermission).toHaveBeenCalledOnce()
  })
})

describe('fireNotification', () => {
  beforeEach(clean)
  afterEach(clean)

  it('shows nothing and reports false when unsupported', async () => {
    await expect(fireNotification('drink water', 'a')).resolves.toBe(false)
  })

  it('shows nothing and reports false when permission is not granted', async () => {
    stubNotification('default')
    await expect(fireNotification('drink water', 'a')).resolves.toBe(false)
  })

  it('constructs a notification with the message as the body', async () => {
    const seen = []
    stubNotification('granted', { onConstruct: (title, options) => seen.push({ title, options }) })
    await expect(fireNotification('drink water', 'nudge-1')).resolves.toBe(true)
    expect(seen).toHaveLength(1)
    expect(seen[0].title).toBe('Stoa')
    expect(seen[0].options.body).toBe('drink water')
    expect(seen[0].options.tag).toBe('nudge-1')
  })
})
