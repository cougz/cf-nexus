import { server } from '@passwordless-id/webauthn'

export interface RegistrationOptions {
  username: string
  challenge: string
  userId?: string
  timeout?: number
}

export interface AuthenticationOptions {
  credentialIds: string[]
  challenge: string
  timeout?: number
}

export interface VerifyRegistrationOptions {
  challenge: string
  origin: string
}

export interface VerifyAuthenticationOptions {
  challenge: string
  origin: string
}

export async function generateChallenge(): Promise<string> {
  const buffer = new Uint8Array(32)
  crypto.getRandomValues(buffer)
  return Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function generateRegistrationOptions(options: RegistrationOptions) {
  const registrationOptions = {
    rp: {
      id: 'nexus',
      name: 'Nexus OIDC Provider',
    },
    user: {
      id: options.userId || options.username,
      name: options.username,
      displayName: options.username,
    },
    challenge: options.challenge,
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ],
    timeout: options.timeout || 60000,
    attestation: 'preferred',
    authenticatorSelection: {
      authenticatorAttachment: 'preferred',
      userVerification: 'preferred',
    },
  }

  return registrationOptions
}

export async function verifyRegistration(
  attestation: unknown,
  options: VerifyRegistrationOptions
): Promise<{ verified: boolean; credentialId?: string }> {
  try {
    const result = await server.verifyRegistration(
      // biome-ignore lint/suspicious/noExplicitAny: External library has complex types
      attestation as any,
      {
        challenge: options.challenge,
        origin: options.origin,
        rpId: 'nexus',
      }
    )
    return {
      verified: result.verified,
      credentialId: result.credentialId,
    }
  } catch (error) {
    console.error('Registration verification failed:', error)
    return { verified: false }
  }
}

export async function generateAuthenticationOptions(options: AuthenticationOptions) {
  const authenticationOptions = {
    challenge: options.challenge,
    allowCredentials: options.credentialIds.map(id => ({
      type: 'public-key',
      id,
    })),
    timeout: options.timeout || 60000,
    userVerification: 'preferred',
  }

  return authenticationOptions
}

export async function verifyAuthentication(
  assertion: unknown,
  options: VerifyAuthenticationOptions
): Promise<{ verified: boolean }> {
  try {
    const result = await server.verifyAuthentication(
      // biome-ignore lint/suspicious/noExplicitAny: External library has complex types
      assertion as any,
      {
        challenge: options.challenge,
        origin: options.origin,
        rpId: 'nexus',
      }
    )
    return { verified: result.verified }
  } catch (error) {
    console.error('Authentication verification failed:', error)
    return { verified: false }
  }
}
