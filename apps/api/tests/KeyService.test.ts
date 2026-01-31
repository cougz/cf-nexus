import { describe, expect, it } from 'bun:test'

describe('KeyService', () => {
  describe('generateKeyPair', () => {
    it('should generate a RSA key pair', async () => {
      const { generateKeyPair } = await import('../src/services/KeyService')

      const keyPair = await generateKeyPair()

      expect(keyPair).toBeDefined()
      expect(keyPair.privateKey).toBeDefined()
      expect(keyPair.publicKey).toBeDefined()
      expect(keyPair.kid).toBeDefined()
      expect(keyPair.privateKey).toContain('-----BEGIN PRIVATE KEY-----')
      expect(keyPair.publicKey).toContain('-----BEGIN PUBLIC KEY-----')
    })
  })

  describe('signJWT', () => {
    it('should sign a JWT with given payload', async () => {
      const { generateKeyPair, signJWT } = await import('../src/services/KeyService')
      const keyPair = await generateKeyPair()
      const payload = { sub: 'user-123' }

      const token = await signJWT(payload, keyPair.privateKey)

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3)
    })

    it('should include RS256 algorithm', async () => {
      const { generateKeyPair, signJWT } = await import('../src/services/KeyService')
      const keyPair = await generateKeyPair()
      const payload = { sub: 'user-123' }

      const token = await signJWT(payload, keyPair.privateKey)
      const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64').toString())

      expect(header.alg).toBe('RS256')
    })
  })

  describe('verifyJWT', () => {
    it('should verify a valid JWT', async () => {
      const { generateKeyPair, signJWT, verifyJWT } = await import('../src/services/KeyService')
      const keyPair = await generateKeyPair()
      const payload = { sub: 'user-123' }

      const token = await signJWT(payload, keyPair.privateKey)
      const decoded = await verifyJWT(token, keyPair.publicKey)

      expect(decoded).toBeDefined()
      expect(decoded.payload.sub).toBe(payload.sub)
    })

    it('should reject invalid JWT', async () => {
      const { generateKeyPair, verifyJWT } = await import('../src/services/KeyService')
      const keyPair = await generateKeyPair()

      await expect(verifyJWT('invalid.token.here', keyPair.publicKey)).rejects.toThrow()
    })

    it('should reject expired JWT', async () => {
      const { generateKeyPair, signJWT, verifyJWT } = await import('../src/services/KeyService')
      const keyPair = await generateKeyPair()
      const expiredPayload = { sub: 'user-123', exp: Math.floor(Date.now() / 1000) - 100 }

      const token = await signJWT(expiredPayload, keyPair.privateKey)

      await expect(verifyJWT(token, keyPair.publicKey)).rejects.toThrow()
    })
  })

  describe('getJWKS', () => {
    it('should return JWKS format', async () => {
      const { generateKeyPair, getJWKS } = await import('../src/services/KeyService')
      const keyPair = await generateKeyPair()

      const jwks = await getJWKS(keyPair.privateKey)

      expect(jwks).toBeDefined()
      expect(jwks.keys).toBeDefined()
      expect(Array.isArray(jwks.keys)).toBe(true)
      expect(jwks.keys[0]).toHaveProperty('kty')
      expect(jwks.keys[0]).toHaveProperty('kid')
    })

    it('should include public key in JWKS', async () => {
      const { generateKeyPair, getJWKS } = await import('../src/services/KeyService')
      const keyPair = await generateKeyPair()

      const jwks = await getJWKS(keyPair.privateKey)

      expect(jwks.keys[0]).toHaveProperty('n')
      expect(jwks.keys[0]).toHaveProperty('e')
      expect(jwks.keys[0].kid).toBe(keyPair.kid)
    })
  })
})
