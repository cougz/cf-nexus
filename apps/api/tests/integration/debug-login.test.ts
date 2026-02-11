import { describe, expect, it } from 'bun:test'

const API_URL = process.env.API_URL || 'https://nexus-api.tim-9c0.workers.dev'

describe('TDD: Debug Login Flow', () => {
  it('should debug /auth/login/options step by step', async () => {
    const username = `test-debug-${Date.now()}`

    console.log('Step 1: Testing valid username')
    if (username.length < 3 || username.length > 50) {
      console.error('Username validation failed')
      expect.fail('Username validation should pass')
    }

    console.log('Step 2: Making request to /auth/login/options')
    const response = await fetch(`${API_URL}/auth/login/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    })

    console.log('Step 3: Response received')
    console.log('Status:', response.status)
    console.log('Status OK:', response.ok)
    console.log('Headers:', Object.fromEntries(response.headers.entries()))

    const responseText = await response.text()
    console.log('Response text:', responseText)

    let data: unknown
    try {
      data = JSON.parse(responseText)
      console.log('Response JSON:', JSON.stringify(data, null, 2))
    } catch (e) {
      console.error('Failed to parse response as JSON:', e)
      console.error('Raw response:', responseText)
      expect.fail('Response should be valid JSON')
    }

    console.log('Step 4: Checking response structure')
    if (response.ok) {
      expect(data).toHaveProperty('action')
      expect(data).toHaveProperty('rp')
      expect(data).toHaveProperty('user')
      expect(data).toHaveProperty('challenge')
      console.log('Test passed: Registration options returned successfully')
    } else {
      console.log('Response indicates error:', data)
      if (data.error?.code === 'REGISTRATION_CLOSED') {
        console.log('Registration is closed - admin user exists')
      } else {
        console.error('Unexpected error:', data.error)
      }
    }
  })
})
