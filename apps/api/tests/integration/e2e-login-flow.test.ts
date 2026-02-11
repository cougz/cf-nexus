import { describe, expect, it } from 'bun:test'

const API_URL = process.env.API_URL || 'https://nexus-api.tim-9c0.workers.dev'

describe('TDD: Login Flow End-to-End', () => {
  it('should return valid JSON from /auth/login/options', async () => {
    const username = `test-user-${Date.now()}`

    const response = await fetch(`${API_URL}/auth/login/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    })

    console.log('Response status:', response.status)
    console.log('Content-Type:', response.headers.get('content-type'))

    expect(response.ok).toBe(true)

    const text = await response.text()
    console.log('Response length:', text.length)
    console.log('First 100 chars:', text.substring(0, 100))

    let data: unknown
    try {
      data = JSON.parse(text)
    } catch (e) {
      console.error('JSON parse error:', e)
      console.error('Raw response:', text.substring(0, 500))
      throw new Error('Response is not valid JSON')
    }

    expect(data).toBeDefined()
    expect(typeof data).toBe('object')

    if (response.ok && typeof data === 'object') {
      expect(data).toHaveProperty('action')
    }
  })

  it('should handle edge cases in username', async () => {
    const testCases = [
      { username: 'a', shouldPass: false },
      { username: 'ab', shouldPass: false },
      { username: 'ab', shouldPass: false },
      { username: 'abc', shouldPass: true },
      { username: 'a'.repeat(51), shouldPass: false },
      { username: 'a'.repeat(50), shouldPass: true },
    ]

    for (const testCase of testCases) {
      const response = await fetch(`${API_URL}/auth/login/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: testCase.username }),
      })

      if (testCase.shouldPass) {
        expect(response.ok).toBe(true)
        const text = await response.text()
        expect(() => JSON.parse(text)).not.toThrow()
      } else {
        expect(response.ok).toBe(false)
      }
    }
  })

  it('should return action field for successful requests', async () => {
    const username = `test-action-${Date.now()}`

    const response = await fetch(`${API_URL}/auth/login/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    })

    expect(response.ok).toBe(true)

    const data = await response.json()

    expect(data).toHaveProperty('action')
    expect(['register', 'authenticate']).toContain(data.action)

    if (data.action === 'register') {
      expect(data).toHaveProperty('rp')
      expect(data).toHaveProperty('user')
      expect(data).toHaveProperty('challenge')
    }

    if (data.action === 'authenticate') {
      expect(data).toHaveProperty('challenge')
      expect(data).toHaveProperty('allowCredentials')
    }
  })
})
