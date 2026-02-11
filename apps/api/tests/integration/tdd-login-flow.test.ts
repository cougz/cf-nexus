import { describe, expect, it } from 'bun:test'

const API_URL = process.env.API_URL || 'https://nexus-api.tim-9c0.workers.dev'

describe('TDD: Login Flow with WebAuthn', () => {
  describe('GET /auth/login/options', () => {
    it('should return registration options for new user when no admin exists', async () => {
      const username = `test-new-user-${Date.now()}`

      const response = await fetch(`${API_URL}/auth/login/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })

      console.log('Response status:', response.status)
      const data = await response.json()
      console.log('Response data:', JSON.stringify(data, null, 2))

      expect(response.ok).toBe(true)
      expect(data).toHaveProperty('action')
      expect(data.action).toBe('register')
      expect(data).toHaveProperty('rp')
      expect(data).toHaveProperty('user')
      expect(data).toHaveProperty('challenge')
    })

    it('should handle existing users (if any)', async () => {
      const username = 'admin'

      const response = await fetch(`${API_URL}/auth/login/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })

      const data = await response.json()

      console.log('Existing user response:', JSON.stringify(data, null, 2))

      if (response.ok) {
        expect(data).toHaveProperty('action')
        expect(data.action).toBe('authenticate')
      } else {
        expect(data.error).toBeDefined()
      }
    })

    it('should reject invalid username (too short)', async () => {
      const response = await fetch(`${API_URL}/auth/login/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'ab' }),
      })

      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toBeDefined()
      expect(data.error.code).toBe('INVALID_REQUEST')
    })
  })
})
