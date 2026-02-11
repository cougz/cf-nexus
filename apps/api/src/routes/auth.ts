import type { UserSchema } from '@nexus/shared'
import { Hono } from 'hono'
import type { UserDO } from '../durable-objects/UserDO'
import { ChallengeService } from '../services/ChallengeService'
import { DatabaseService } from '../services/DatabaseService'
import {
  generateAuthenticationOptions,
  generateChallenge,
  generateRegistrationOptions,
  verifyAuthentication,
  verifyRegistration,
} from '../services/WebAuthnService'

type Env = {
  Bindings: {
    DB: D1Database
    KV: KVNamespace
    UserDO: DurableObjectNamespace
  }
}

const auth = new Hono<Env>()

auth.post('/register/options', async c => {
  const body = await c.req.json()

  if (!body.username || typeof body.username !== 'string') {
    return c.json(
      { error: { message: 'Invalid request', code: 'INVALID_REQUEST' } },
      { status: 400 }
    )
  }

  const username = body.username.trim()

  if (username.length < 3) {
    return c.json(
      { error: { message: 'Invalid request', code: 'INVALID_REQUEST' } },
      { status: 400 }
    )
  }

  if (username.length > 50) {
    return c.json(
      { error: { message: 'Invalid request', code: 'INVALID_REQUEST' } },
      { status: 400 }
    )
  }

  const challenge = await generateChallenge()
  const userId = crypto.randomUUID()

  const registrationOptions = await generateRegistrationOptions({
    username,
    userId,
    challenge,
    timeout: 60000,
  })

  const challengeService = new ChallengeService(c.env.KV)
  await challengeService.storeChallenge({
    username,
    challenge,
    type: 'registration',
    createdAt: new Date().toISOString(),
  })

  return c.json(registrationOptions)
})

auth.post('/register/verify', async c => {
  const body = await c.req.json()

  if (!body.attestation || !body.challenge) {
    return c.json(
      { error: { message: 'Invalid request', code: 'INVALID_REQUEST' } },
      { status: 400 }
    )
  }

  const challengeService = new ChallengeService(c.env.KV)
  const challengeData = await challengeService.getChallenge(body.challenge)

  if (!challengeData || challengeData.type !== 'registration') {
    await challengeService.deleteChallenge(body.challenge)
    return c.json(
      { error: { message: 'Invalid request', code: 'INVALID_REQUEST' } },
      { status: 400 }
    )
  }

  const verifyResult = await verifyRegistration(body.attestation, {
    challenge: body.challenge,
    origin: c.req.header('Origin') || 'https://api.nexus.example.com',
  })

  if (!verifyResult.verified || !verifyResult.credentialId) {
    await challengeService.deleteChallenge(body.challenge)
    return c.json(
      { error: { message: 'Invalid request', code: 'INVALID_REQUEST' } },
      { status: 400 }
    )
  }

  const userDOId = c.env.UserDO.idFromName(challengeData.username)
  const userDO = c.env.UserDO.get(userDOId) as unknown as UserDO

  let user: { id: string; username: string; isAdmin: boolean; createdAt: string } | null = null

  const db = new DatabaseService(c.env.DB)
  const existingUserIds = await db.getAllUserIds()
  const isFirstUser = existingUserIds.length === 0

  try {
    user = await userDO.createUser({ username: challengeData.username, isAdmin: isFirstUser })
  } catch {
    await challengeService.deleteChallenge(body.challenge)
    return c.json(
      { error: { message: 'Invalid request', code: 'INVALID_REQUEST' } },
      { status: 400 }
    )
  }

  try {
    const attestation = body.attestation as {
      response: { publicKey?: string; transports?: string[] }
    }
    await db.createCredential({
      id: verifyResult.credentialId,
      userId: user.id,
      publicKey: attestation.response.publicKey || '',
      transports: attestation.response.transports,
    })
  } catch {
    await challengeService.deleteChallenge(body.challenge)
    return c.json(
      { error: { message: 'Invalid request', code: 'INVALID_REQUEST' } },
      { status: 400 }
    )
  }

  await challengeService.deleteChallenge(body.challenge)

  return c.json({ user })
})

auth.post('/login/options', async c => {
  const body = await c.req.json()

  if (!body.username || typeof body.username !== 'string') {
    return c.json(
      { error: { message: 'Invalid request', code: 'INVALID_REQUEST' } },
      { status: 400 }
    )
  }

  const username = body.username.trim()

  if (username.length < 3 || username.length > 50) {
    return c.json(
      { error: { message: 'Invalid request', code: 'INVALID_REQUEST' } },
      { status: 400 }
    )
  }

  const userDOId = c.env.UserDO.idFromName(username)
  const userDO = c.env.UserDO.get(userDOId) as unknown as UserDO

  let user: { id: string; username: string; isAdmin: boolean; createdAt: string } | null = null

  try {
    user = await userDO.getUserByUsername(username)
  } catch {
    return c.json(
      { error: { message: 'Invalid request', code: 'INVALID_REQUEST' } },
      { status: 400 }
    )
  }

  if (!user) {
    const db = new DatabaseService(c.env.DB)
    const existingUserIds = await db.getAllUserIds()
    const hasAdmin = existingUserIds.length > 0

    if (hasAdmin) {
      return c.json(
        {
          error: {
            message: 'Registration closed. Contact administrator.',
            code: 'REGISTRATION_CLOSED',
          },
        },
        { status: 403 }
      )
    }

    const challenge = await generateChallenge()
    const userId = crypto.randomUUID()

    const registrationOptions = await generateRegistrationOptions({
      username,
      userId,
      challenge,
      timeout: 60000,
    })

    const challengeService = new ChallengeService(c.env.KV)
    await challengeService.storeChallenge({
      username,
      challenge,
      type: 'registration',
      createdAt: new Date().toISOString(),
    })

    return c.json({ action: 'register', ...registrationOptions })
  }

  const db = new DatabaseService(c.env.DB)
  const credentials = await db.getCredentialsByUserId(user.id)

  if (credentials.length === 0) {
    return c.json(
      { error: { message: 'Invalid request', code: 'INVALID_REQUEST' } },
      { status: 400 }
    )
  }

  const challenge = await generateChallenge()
  const credentialIds = credentials.map(cred => cred.id)

  const authenticationOptions = await generateAuthenticationOptions({
    credentialIds,
    challenge,
    timeout: 60000,
  })

  const challengeService = new ChallengeService(c.env.KV)
  await challengeService.storeChallenge({
    username,
    challenge,
    type: 'authentication',
    credentialIds,
    createdAt: new Date().toISOString(),
  })

  return c.json({ action: 'authenticate', ...authenticationOptions })
})

auth.post('/login/verify', async c => {
  const body = await c.req.json()

  if (!body.assertion || !body.challenge) {
    return c.json(
      { error: { message: 'Invalid request', code: 'INVALID_REQUEST' } },
      { status: 400 }
    )
  }

  const challengeService = new ChallengeService(c.env.KV)
  const challengeData = await challengeService.getChallenge(body.challenge)

  if (!challengeData || challengeData.type !== 'authentication') {
    await challengeService.deleteChallenge(body.challenge)
    return c.json(
      { error: { message: 'Invalid request', code: 'INVALID_REQUEST' } },
      { status: 400 }
    )
  }

  const verifyResult = await verifyAuthentication(body.assertion, {
    challenge: body.challenge,
    origin: c.req.header('Origin') || 'https://api.nexus.example.com',
  })

  if (!verifyResult.verified) {
    await challengeService.deleteChallenge(body.challenge)
    return c.json(
      { error: { message: 'Invalid request', code: 'INVALID_REQUEST' } },
      { status: 400 }
    )
  }

  const userDOId = c.env.UserDO.idFromName(challengeData.username)
  const userDO = c.env.UserDO.get(userDOId) as unknown as UserDO

  let user: { id: string; username: string; createdAt: string } | null = null
  let sessionId: string | undefined

  try {
    const session = await userDO.createSession(86400000)
    sessionId = session.token
    user = await userDO.getUser(session.userId)
  } catch {
    await challengeService.deleteChallenge(body.challenge)
    return c.json(
      { error: { message: 'Invalid request', code: 'INVALID_REQUEST' } },
      { status: 400 }
    )
  }

  await challengeService.deleteChallenge(body.challenge)

  // Set HttpOnly, Secure, SameSite=Strict session cookie
  if (sessionId) {
    c.header(
      'Set-Cookie',
      `session=${sessionId}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`
    )
  }

  return c.json({ user })
})

auth.post('/logout', async c => {
  const sessionCookie = c.req.header('Cookie') || ''
  const sessionId = sessionCookie
    .split(';')
    .find(c => c.trim().startsWith('session='))
    ?.split('=')[1]

  if (sessionId) {
    const userDOId = c.env.UserDO.idFromName(`user-${sessionId}`)
    const userDO = c.env.UserDO.get(userDOId) as unknown as UserDO

    try {
      await userDO.revokeSession(sessionId)
    } catch {
      // Ignore errors on session revocation
    }
  }

  c.header('Set-Cookie', 'session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0')

  return c.json({ message: 'Logged out successfully' })
})

export default auth
