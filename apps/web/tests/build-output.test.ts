import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('TDD: Frontend Build Output', () => {
  it('should have correct API_URL in login.html', async () => {
    const distDir = join(process.cwd(), 'dist')
    const htmlPath = join(distDir, 'login', 'index.html')
    const html = readFileSync(htmlPath, 'utf-8')

    expect(html).toContain('const API_URL = apiUrl')
    expect(html).toContain('const apiUrl = "https://nexus-api.tim-9c0.workers.dev"')

    const apiRegex = /const API_URL = apiUrl/
    expect(apiRegex.test(html)).toBe(true)

    const apiUrlRegex = /const apiUrl = "https:\/\/nexus-api\.tim-9c0\.workers\.dev"/
    expect(apiUrlRegex.test(html)).toBe(true)

    expect(html).not.toContain('{{ apiUrl }}')
    expect(html).not.toContain("const API_URL = '{{ apiUrl }}'")
  })

  it('should have correct API_URL in consent.html', async () => {
    const distDir = join(process.cwd(), 'dist')
    const htmlPath = join(distDir, 'consent', 'index.html')
    const html = readFileSync(htmlPath, 'utf-8')

    expect(html).toContain('const API_URL = apiUrl')
    expect(html).toContain('const apiUrl = "https://nexus-api.tim-9c0.workers.dev"')

    expect(html).not.toContain('{{ apiUrl }}')
    expect(html).not.toContain("const API_URL = '{{ apiUrl }}'")
  })

  it('should have valid JSON responses from API endpoints', async () => {
    const API_URL = process.env.API_URL || 'https://nexus-api.tim-9c0.workers.dev'

    const response = await fetch(`${API_URL}/auth/login/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'test-user-build' }),
    })

    expect(response.ok).toBe(true)

    const text = await response.text()
    expect(() => JSON.parse(text)).not.toThrow()

    const data = JSON.parse(text)
    expect(data).toHaveProperty('action')
  })

  it('should handle invalid username correctly', async () => {
    const API_URL = process.env.API_URL || 'https://nexus-api.tim-9c0.workers.dev'

    const response = await fetch(`${API_URL}/auth/login/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ab' }),
    })

    expect(response.ok).toBe(false)

    const text = await response.text()
    expect(() => JSON.parse(text)).not.toThrow()

    const data = JSON.parse(text)
    expect(data).toHaveProperty('error')
    expect(data.error).toHaveProperty('message')
  })
})
