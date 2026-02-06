import { describe, expect, it } from 'bun:test'

const API_URL = process.env.API_URL || 'https://nexus-api.tim-9c0.workers.dev'

describe('Deployed API Integration Tests', () => {
  describe('POST /auth/register/options', () => {
    it('should return registration options', async () => {
      const response = await fetch(`${API_URL}/auth/register/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testuser' }),
      })

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.challenge).toBeDefined()
      expect(json.user).toBeDefined()
      expect(json.rp).toBeDefined()
      expect(json.pubKeyCredParams).toBeDefined()
    })

    it('should return 400 for missing username', async () => {
      const response = await fetch(`${API_URL}/auth/register/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error.message).toBe('Invalid request')
      expect(json.error.code).toBe('INVALID_REQUEST')
    })

    it('should return 400 for short username', async () => {
      const response = await fetch(`${API_URL}/auth/register/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'ab' }),
      })

      expect(response.status).toBe(400)
    })

    it('should return 400 for long username', async () => {
      const response = await fetch(`${API_URL}/auth/register/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'a'.repeat(51) }),
      })

      expect(response.status).toBe(400)
    })
  })

  describe('POST /auth/login/options', () => {
    it('should return 400 for missing username', async () => {
      const response = await fetch(`${API_URL}/auth/login/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error.message).toBe('Invalid request')
      expect(json.error.code).toBe('INVALID_REQUEST')
    })
  })
})
