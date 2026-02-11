import { describe, expect, it } from 'bun:test'

const API_URL = process.env.API_URL || 'https://nexus-api.tim-9c0.workers.dev'

describe('Debug Challenge Storage', () => {
  it('should store and retrieve challenge', async () => {
    const username = `testuser-${Date.now()}`

    const response = await fetch(`${API_URL}/auth/register/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    })

    const options = await response.json()
    console.log('Challenge:', options.challenge)

    const verifyResponse = await fetch(`${API_URL}/auth/register/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challenge: options.challenge,
        attestation: {
          id: 'test-credential-id',
        },
      }),
    })

    const verifyJson = await verifyResponse.json()
    console.log('Verify response status:', verifyResponse.status)
    console.log('Verify response:', JSON.stringify(verifyJson, null, 2))
  })
})
