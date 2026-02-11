import { describe, expect, it } from 'bun:test'

describe('WebAuthnService', () => {
  describe('generateChallenge', () => {
    it('should generate a random challenge', async () => {
      const { generateChallenge } = await import('../src/services/WebAuthnService')

      const challenge = await generateChallenge()

      expect(challenge).toBeDefined()
      expect(typeof challenge).toBe('string')
      expect(challenge.length).toBeGreaterThan(0)
    })

    it('should generate unique challenges', async () => {
      const { generateChallenge } = await import('../src/services/WebAuthnService')

      const challenge1 = await generateChallenge()
      const challenge2 = await generateChallenge()

      expect(challenge1).not.toBe(challenge2)
    })
  })

  describe('generateRegistrationOptions', () => {
    it('should generate registration options for user', async () => {
      const { generateRegistrationOptions } = await import('../src/services/WebAuthnService')

      const options = await generateRegistrationOptions({
        username: 'testuser',
        challenge: 'random-challenge',
      })

      expect(options).toBeDefined()
      expect(options).toHaveProperty('challenge')
      expect(options).toHaveProperty('user')
      expect(options).toHaveProperty('rp')
      expect(options).toHaveProperty('pubKeyCredParams')
    })

    it('should include correct relying party info', async () => {
      const { generateRegistrationOptions } = await import('../src/services/WebAuthnService')

      const options = await generateRegistrationOptions({
        username: 'testuser',
        challenge: 'random-challenge',
      })

      expect(options.rp).toHaveProperty('name')
      expect(options.rp).toHaveProperty('id')
    })
  })

  describe('verifyRegistration', () => {
    it('should fail verification for invalid attestation data', async () => {
      const { verifyRegistration } = await import('../src/services/WebAuthnService')

      const attestation = {
        id: 'test-credential-id',
        rawId: Buffer.from('test-credential-id').toString('base64'),
        response: {
          clientDataJSON: '{}',
          attestationObject: Buffer.from('test-attestation'),
        },
      }

      const result = await verifyRegistration(attestation, {
        challenge: 'random-challenge',
        origin: 'https://example.com',
      })

      expect(result).toBeDefined()
      expect(result).toHaveProperty('verified')
      expect(result.verified).toBe(false)
    })
  })

  describe('generateAuthenticationOptions', () => {
    it('should generate authentication options', async () => {
      const { generateAuthenticationOptions } = await import('../src/services/WebAuthnService')

      const options = await generateAuthenticationOptions({
        credentialIds: ['cred-id-1', 'cred-id-2'],
        challenge: 'random-challenge',
      })

      expect(options).toBeDefined()
      expect(options).toHaveProperty('challenge')
      expect(options).toHaveProperty('allowCredentials')
    })

    it('should include user credentials in allowCredentials', async () => {
      const { generateAuthenticationOptions } = await import('../src/services/WebAuthnService')

      const options = await generateAuthenticationOptions({
        credentialIds: ['cred-id-1'],
        challenge: 'random-challenge',
      })

      expect(options.allowCredentials).toBeDefined()
      expect(options.allowCredentials.length).toBe(1)
    })
  })

  describe('verifyAuthentication', () => {
    it('should fail verification for invalid assertion data', async () => {
      const { verifyAuthentication } = await import('../src/services/WebAuthnService')

      const assertion = {
        id: 'test-credential-id',
        rawId: Buffer.from('test-credential-id').toString('base64'),
        response: {
          clientDataJSON: '{}',
          authenticatorData: Buffer.from('test-authenticator-data'),
          signature: Buffer.from('test-signature'),
          userHandle: Buffer.from('test-user-handle'),
        },
      }

      const result = await verifyAuthentication(assertion, {
        challenge: 'random-challenge',
        origin: 'https://example.com',
      })

      expect(result).toBeDefined()
      expect(result).toHaveProperty('verified')
      expect(result.verified).toBe(false)
    })
  })
})
