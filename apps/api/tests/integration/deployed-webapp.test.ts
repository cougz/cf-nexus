import { describe, expect, it } from 'bun:test'

const WEB_URL = 'https://nexus-web-7l6.pages.dev'
const API_URL = 'https://nexus-api.tim-9c0.workers.dev'

describe('TDD: Deployed Web App Integration Test', () => {
  it('should load login page successfully', async () => {
    const response = await fetch(`${WEB_URL}/login`)
    expect(response.ok).toBe(true)

    const html = await response.text()

    expect(html).toContain('Welcome to Nexus')
    expect(html).toContain('Sign In with Passkey')
    expect(html).toContain('const API_URL = apiUrl')
    expect(html).not.toContain('{{')
  })

  it('should have signinButton element', async () => {
    const response = await fetch(`${WEB_URL}/login`)
    const html = await response.text()

    expect(html).toContain('id="signinButton"')
    expect(html).toContain('type="button"')
  })

  it('should have click event listener', async () => {
    const response = await fetch(`${WEB_URL}/login`)
    const html = await response.text()

    expect(html).toContain('addEventListener')
    expect(html).toContain("'click'")
    expect(html).toContain('signinButton?.addEventListener')
  })

  it('should not have form submit event', async () => {
    const response = await fetch(`${WEB_URL}/login`)
    const html = await response.text()

    expect(html).not.toMatch(/addEventListener.*'submit'/)
  })

  it('should have console.log for debugging', async () => {
    const response = await fetch(`${WEB_URL}/login`)
    const html = await response.text()

    expect(html).toContain('console.log')
    expect(html).toContain('Starting login process')
  })

  it('should return valid JSON from API /auth/login/options', async () => {
    const response = await fetch(`${API_URL}/auth/login/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'test-webapp' }),
    })

    expect(response.ok).toBe(true)

    const text = await response.text()
    console.log('API Response:', text.substring(0, 200))

    let data: unknown
    try {
      data = JSON.parse(text)
    } catch (e) {
      console.error('Failed to parse API response:', text.substring(0, 500))
      throw e
    }

    expect(data).toBeDefined()
    expect(typeof data).toBe('object')

    if (typeof data === 'object' && 'action' in data) {
      expect(['register', 'authenticate']).toContain((data as any).action)
    }
  })
})
