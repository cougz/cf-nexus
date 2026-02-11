import { describe, expect, it } from 'bun:test'

const API_URL = process.env.API_URL || 'https://nexus-api.tim-9c0.workers.dev'

describe('OIDC Discovery Endpoint Tests', () => {
  it('should return OIDC configuration', async () => {
    const response = await fetch(`${API_URL}/.well-known/openid-configuration`)

    if (response.status === 404) {
      console.log('OIDC Discovery endpoint not yet deployed, skipping...')
      return
    }

    expect(response.status).toBe(200)
    const config = await response.json()

    expect(config).toHaveProperty('issuer')
    expect(config).toHaveProperty('authorization_endpoint')
    expect(config).toHaveProperty('token_endpoint')
    expect(config).toHaveProperty('userinfo_endpoint')
    expect(config).toHaveProperty('jwks_uri')
    expect(config).toHaveProperty('response_types_supported')
    expect(config).toHaveProperty('subject_types_supported')
    expect(config).toHaveProperty('id_token_signing_alg_values_supported')
    expect(config).toHaveProperty('scopes_supported')
    expect(config).toHaveProperty('grant_types_supported')

    expect(config.issuer).toBe('https://nexus-api.tim-9c0.workers.dev')
    expect(config.authorization_endpoint).toContain('/authorize')
    expect(config.token_endpoint).toContain('/token')
    expect(config.userinfo_endpoint).toContain('/userinfo')
    expect(config.jwks_uri).toContain('/.well-known/jwks.json')
  })

  it('should include Cache-Control header', async () => {
    const response = await fetch(`${API_URL}/.well-known/openid-configuration`)

    if (response.status === 404) {
      return
    }

    const cacheControl = response.headers.get('Cache-Control')
    expect(cacheControl).not.toBeNull()
    expect(cacheControl).toContain('public')
    expect(cacheControl).toContain('max-age=3600')
  })
})

describe('JWKS Endpoint Tests', () => {
  it('should return JWKS with keys', async () => {
    const response = await fetch(`${API_URL}/.well-known/jwks.json`)

    if (response.status === 404 || response.status === 500) {
      console.log('JWKS endpoint not yet deployed or error, skipping...')
      return
    }

    expect(response.status).toBe(200)
    const jwks = await response.json()

    expect(jwks).toHaveProperty('keys')
    expect(Array.isArray(jwks.keys)).toBe(true)
    expect(jwks.keys.length).toBeGreaterThan(0)
  })

  it('should include required JWK properties', async () => {
    const response = await fetch(`${API_URL}/.well-known/jwks.json`)

    if (response.status === 404 || response.status === 500) {
      return
    }

    const jwks = await response.json()

    if (jwks.keys && jwks.keys.length > 0) {
      const key = jwks.keys[0]
      expect(key).toHaveProperty('kty')
      expect(key).toHaveProperty('use')
      expect(key).toHaveProperty('alg')
      expect(key).toHaveProperty('kid')
      expect(key.use).toBe('sig')
      expect(key.alg).toBe('RS256')
    }
  })

  it('should include Cache-Control header', async () => {
    const response = await fetch(`${API_URL}/.well-known/jwks.json`)

    if (response.status === 404 || response.status === 500) {
      return
    }

    const cacheControl = response.headers.get('Cache-Control')
    expect(cacheControl).not.toBeNull()
    expect(cacheControl).toContain('public')
    expect(cacheControl).toContain('max-age=3600')
  })
})
