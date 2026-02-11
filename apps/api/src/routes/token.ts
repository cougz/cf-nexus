import { Hono } from 'hono'
import type { UserDO } from '../durable-objects/UserDO'
import { signJWT } from '../services/KeyService'

type Env = {
  Bindings: {
    DB: D1Database
    KV: KVNamespace
    UserDO: DurableObjectNamespace
  }
}

interface AuthCode {
  code: string
  clientId: string
  redirectUri: string
  scope: string
  userId: string
  expiresAt: string
}

const token = new Hono<Env>()

token.post('/token', async c => {
  const { grant_type, code, redirect_uri, client_id, code_verifier } = await c.req.json()

  if (grant_type !== 'authorization_code') {
    return c.json(
      {
        error: 'unsupported_grant_type',
        error_description: 'Only authorization_code is supported',
      },
      { status: 400 }
    )
  }

  if (!code || !redirect_uri || !client_id) {
    return c.json(
      {
        error: 'invalid_request',
        error_description: 'code, redirect_uri, and client_id are required',
      },
      { status: 400 }
    )
  }

  const db = c.env.DB
  const clientResult = await db
    .prepare('SELECT id FROM oidc_clients WHERE id = ?')
    .bind(client_id)
    .first()

  if (!clientResult) {
    return c.json(
      { error: 'invalid_client', error_description: 'Client not found' },
      { status: 401 }
    )
  }

  const authCodeKey = `auth_code:${code}`
  const authCodeValue = await c.env.KV.get(authCodeKey)

  if (!authCodeValue) {
    return c.json(
      { error: 'invalid_grant', error_description: 'Invalid or expired authorization code' },
      { status: 400 }
    )
  }

  const authCodeData: AuthCode = JSON.parse(authCodeValue)

  if (authCodeData.clientId !== client_id || authCodeData.redirectUri !== redirect_uri) {
    await c.env.KV.delete(authCodeKey)
    return c.json(
      { error: 'invalid_grant', error_description: 'Authorization code does not match request' },
      { status: 400 }
    )
  }

  if (new Date(authCodeData.expiresAt) < new Date()) {
    await c.env.KV.delete(authCodeKey)
    return c.json(
      { error: 'invalid_grant', error_description: 'Authorization code has expired' },
      { status: 400 }
    )
  }

  const privateKey = await c.env.KV.get('oidc:private_key')
  if (!privateKey) {
    return c.json(
      { error: 'server_error', error_description: 'JWT signing key not available' },
      { status: 500 }
    )
  }

  const userDOId = c.env.UserDO.idFromName(`user-${authCodeData.userId}`)
  const userDO = c.env.UserDO.get(userDOId) as unknown as UserDO

  let user: { id: string; username: string; createdAt: string } | null = null
  try {
    user = await userDO.getUser(authCodeData.userId)
  } catch {
    await c.env.KV.delete(authCodeKey)
    return c.json({ error: 'invalid_grant', error_description: 'User not found' }, { status: 400 })
  }

  if (!user) {
    await c.env.KV.delete(authCodeKey)
    return c.json({ error: 'invalid_grant', error_description: 'User not found' }, { status: 400 })
  }

  const jti = crypto.randomUUID()
  const now = Math.floor(Date.now() / 1000)

  const idTokenPayload = {
    iss: 'https://nexus-api.tim-9c0.workers.dev',
    sub: user.id,
    aud: client_id,
    exp: now + 3600,
    iat: now,
    jti,
    nonce: code_verifier,
  }

  const accessTokenPayload = {
    iss: 'https://nexus-api.tim-9c0.workers.dev',
    sub: user.id,
    aud: client_id,
    exp: now + 3600,
    iat: now,
    jti,
    scope: authCodeData.scope,
  }

  const idToken = await signJWT(idTokenPayload, privateKey)
  const accessToken = await signJWT(accessTokenPayload, privateKey)

  await c.env.KV.delete(authCodeKey)

  return c.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    id_token: idToken,
    scope: authCodeData.scope,
  })
})

export default token
