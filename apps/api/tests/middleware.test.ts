import { beforeEach, describe, expect, it } from 'bun:test'
import type { Hono } from 'hono'

describe('API Middleware', () => {
  let app: Hono<unknown>

  beforeEach(async () => {
    const { default: defaultApp } = await import('../src/index')
    app = defaultApp
  })

  describe('Error Handling Middleware', () => {
    it('should handle 404 errors', async () => {
      const response = await app.request(new Request('http://localhost/non-existent'))

      expect(response.status).toBe(404)
      const json = await response.json()
      expect(json).toHaveProperty('error')
      expect(json.error.code).toBe('NOT_FOUND')
    })

    it('should return proper error format', async () => {
      const response = await app.request(new Request('http://localhost/non-existent'))

      const json = await response.json()
      expect(json).toHaveProperty('error')
      expect(json.error).toHaveProperty('message')
      expect(json.error).toHaveProperty('code')
    })
  })

  describe('CORS Middleware', () => {
    it('should add CORS headers for OPTIONS request', async () => {
      const response = await app.request(
        new Request('http://localhost/health', {
          method: 'OPTIONS',
          headers: { Origin: 'https://example.com' },
        })
      )

      expect(response.status).toBe(204)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com')
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET')
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST')
    })

    it('should add CORS headers for regular request', async () => {
      const response = await app.request(
        new Request('http://localhost/health', {
          headers: { Origin: 'https://example.com' },
        })
      )

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com')
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true')
    })
  })

  describe('Response Time Middleware', () => {
    it('should add X-Response-Time header', async () => {
      const response = await app.request(new Request('http://localhost/health'))

      const responseTime = response.headers.get('X-Response-Time')
      expect(responseTime).toBeDefined()
    })
  })

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await app.request(new Request('http://localhost/health'))

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.status).toBe('ok')
      expect(json).toHaveProperty('timestamp')
    })
  })
})
