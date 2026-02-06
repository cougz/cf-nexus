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

  let user: { id: string; username: string; createdAt: string } | null = null

  try {
    user = await userDO.createUser({ username: challengeData.username })
  } catch {
    await challengeService.deleteChallenge(body.challenge)
    return c.json(
      { error: { message: 'Invalid request', code: 'INVALID_REQUEST' } },
      { status: 400 }
    )
  }

  const db = new DatabaseService(c.env.DB)

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

  let user: { id: string; username: string; createdAt: string } | null = null

  try {
    user = await userDO.getUserByUsername(username)
  } catch {
    return c.json(
      { error: { message: 'Invalid request', code: 'INVALID_REQUEST' } },
      { status: 400 }
    )
  }

  if (!user) {
    return c.json(
      { error: { message: 'Invalid request', code: 'INVALID_REQUEST' } },
      { status: 400 }
    )
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

  return c.json(authenticationOptions)
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
    sessionId = session.id
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
    c.cookie('session', sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      path: '/',
      maxAge: 86400, // 24 hours
    })
  }

  return c.json({ user })
})

export default auth
