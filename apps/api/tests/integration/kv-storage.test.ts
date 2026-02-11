import { describe, expect, it } from 'bun:test'

const API_URL = process.env.API_URL || 'https://nexus-api.tim-9c0.workers.dev'

describe('KV Storage Integration Tests', () => {
  it('should store and retrieve challenge', async () => {
    const username = `testuser-${Date.now()}`
    const response = await fetch(`${API_URL}/auth/register/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    })

    expect(response.status).toBe(200)
    const options = await response.json()
    expect(options.challenge).toBeDefined()
    console.log('Challenge generated:', options.challenge)

    // Try to verify with the challenge immediately
    const verifyResponse = await fetch(`${API_URL}/auth/register/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challenge: options.challenge,
        attestation: {
          id: 'mock-credential-id',
          response: {
            publicKey: 'mock-public-key',
            transports: ['internal'],
          },
        },
      }),
    })

    const verifyJson = await verifyResponse.json()
    console.log('Verify response status:', verifyResponse.status)
    console.log('Verify response:', JSON.stringify(verifyJson, null, 2))
  })
})
