import { Hono } from 'hono'
import { UserDO } from './durable-objects/UserDO'
import auth from './routes/auth'
import authorize from './routes/authorize'
import debug from './routes/debug'
import simpleAuth from './routes/simple-auth'
import token from './routes/token'
import userinfo from './routes/userinfo'
import { generateKeyPair, getJWKS } from './services/KeyService'

type Env = {
  Bindings: {
    DB: D1Database
    KV: KVNamespace
    UserDO: DurableObjectNamespace
  }
}

const ISSUER = 'https://nexus-api.tim-9c0.workers.dev'

const OIDC_CONFIG = {
  issuer: ISSUER,
  authorization_endpoint: `${ISSUER}/authorize`,
  token_endpoint: `${ISSUER}/token`,
  userinfo_endpoint: `${ISSUER}/userinfo`,
  jwks_uri: `${ISSUER}/.well-known/jwks.json`,
  response_types_supported: ['code', 'id_token', 'token id_token'],
  subject_types_supported: ['public'],
  id_token_signing_alg_values_supported: ['RS256'],
  scopes_supported: ['openid', 'profile', 'email'],
  token_endpoint_auth_methods_supported: ['client_secret_post', 'private_key_jwt'],
  claims_supported: ['sub', 'name', 'email'],
  grant_types_supported: ['authorization_code'],
}

const app = new Hono<Env>()

app.use('*', async (c, next) => {
  const start = Date.now()
  await next()
  const duration = Date.now() - start
  c.header('X-Response-Time', `${duration}ms`)
})

app.use('*', async (c, next) => {
  const origin = c.req.header('Origin')
  if (origin) {
    c.header('Access-Control-Allow-Origin', origin)
    c.header('Access-Control-Allow-Credentials', 'true')
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  }
  if (c.req.method === 'OPTIONS') {
    return c.newResponse(null, { status: 204 })
  }
  return next()
})

app.onError((err, c) => {
  console.error('Error:', err)
  return c.json(
    {
      error: {
        message: err.message || 'Internal Server Error',
        code: 'INTERNAL_ERROR',
      },
    },
    { status: 500 }
  )
})

app.notFound(c => {
  return c.json(
    {
      error: {
        message: 'Not Found',
        code: 'NOT_FOUND',
      },
    },
    404
  )
})

app.get('/', c => {
  return c.json({ message: 'Nexus API' })
})

app.get('/health', c => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/.well-known/openid-configuration', async c => {
  const cacheKey = 'oidc:configuration'
  try {
    const cached = await c.env.KV.get(cacheKey)
    if (cached) {
      return c.json(JSON.parse(cached), {
        headers: {
          'Cache-Control': 'public, max-age=3600',
        },
      })
    }
  } catch {}
  c.env.KV.put(cacheKey, JSON.stringify(OIDC_CONFIG), { expirationTtl: 3600 })

  return c.json(OIDC_CONFIG, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
    },
  })
})

app.get('/.well-known/jwks.json', async c => {
  const cacheKey = 'oidc:jwks'
  const keyCacheKey = 'oidc:private_key'

  try {
    const cached = await c.env.KV.get(cacheKey)
    if (cached) {
      return c.json(JSON.parse(cached), {
        headers: {
          'Cache-Control': 'public, max-age=3600',
        },
      })
    }
  } catch {}

  let privateKey = await c.env.KV.get(keyCacheKey)

  if (!privateKey) {
    const keyPair = await generateKeyPair()
    privateKey = keyPair.privateKey
    const publicKey = keyPair.publicKey
    await c.env.KV.put(keyCacheKey, privateKey)
    await c.env.KV.put('oidc:public_key', publicKey)
  }

  const jwks = await getJWKS(privateKey)

  c.env.KV.put(cacheKey, JSON.stringify(jwks), { expirationTtl: 3600 })

  return c.json(jwks, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
    },
  })
})

app.get('/authorize', async c => {
  const { response_type, client_id, redirect_uri, scope, state } = c.req.query()

  if (!response_type || response_type !== 'code') {
    return c.json(
      { error: 'invalid_request', error_description: 'response_type must be code' },
      { status: 400 }
    )
  }

  if (!client_id || !redirect_uri) {
    return c.json(
      { error: 'invalid_request', error_description: 'client_id and redirect_uri are required' },
      { status: 400 }
    )
  }

  const db = c.env.DB
  const clientResult = await db
    .prepare('SELECT id, name, redirect_uris FROM oidc_clients WHERE id = ?')
    .bind(client_id)
    .first()

  if (!clientResult) {
    return c.json(
      { error: 'invalid_client', error_description: 'Client not found' },
      { status: 401 }
    )
  }

  const clientRedirectUris = JSON.parse(
    (clientResult as Record<string, unknown>).redirect_uris as string
  )
  if (!clientRedirectUris.includes(redirect_uri)) {
    return c.json(
      { error: 'invalid_request', error_description: 'Invalid redirect_uri' },
      { status: 400 }
    )
  }

  const sessionCookie = c.req.header('Cookie') || ''
  const sessionId = sessionCookie
    .split(';')
    .find(c => c.trim().startsWith('session='))
    ?.split('=')[1]

  if (!sessionId) {
    const loginUrl = new URL('/login', 'https://nexus-web-7l6.pages.dev')
    loginUrl.searchParams.set('client_id', client_id)
    loginUrl.searchParams.set('redirect_uri', redirect_uri)
    loginUrl.searchParams.set('scope', scope || 'openid profile email')
    if (state) loginUrl.searchParams.set('state', state)
    return c.redirect(loginUrl.toString())
  }

  const userDOId = c.env.UserDO.idFromName(`user-${sessionId}`)
  const userDO = c.env.UserDO.get(userDOId) as unknown as UserDO

  let user: { id: string; username: string; createdAt: string } | null = null
  try {
    const session = await userDO.validateSession(sessionId)
    if (!session) {
      const loginUrl = new URL('/login', 'https://nexus-web-7l6.pages.dev')
      loginUrl.searchParams.set('client_id', client_id)
      loginUrl.searchParams.set('redirect_uri', redirect_uri)
      loginUrl.searchParams.set('scope', scope || 'openid profile email')
      if (state) loginUrl.searchParams.set('state', state)
      return c.redirect(loginUrl.toString())
    }

    user = await userDO.getUser(session.userId)
  } catch {
    const loginUrl = new URL('/login', 'https://nexus-web-7l6.pages.dev')
    loginUrl.searchParams.set('client_id', client_id)
    loginUrl.searchParams.set('redirect_uri', redirect_uri)
    loginUrl.searchParams.set('scope', scope || 'openid profile email')
    if (state) loginUrl.searchParams.set('state', state)
    return c.redirect(loginUrl.toString())
  }

  if (!user) {
    const loginUrl = new URL('/login', 'https://nexus-web-7l6.pages.dev')
    loginUrl.searchParams.set('client_id', client_id)
    loginUrl.searchParams.set('redirect_uri', redirect_uri)
    loginUrl.searchParams.set('scope', scope || 'openid profile email')
    if (state) loginUrl.searchParams.set('state', state)
    return c.redirect(loginUrl.toString())
  }

  const authCode = crypto.randomUUID()
  const codeData = {
    code: authCode,
    clientId: client_id,
    redirectUri: redirect_uri,
    scope: scope || 'openid profile email',
    userId: user.id,
    expiresAt: new Date(Date.now() + 600000).toISOString(),
  }

  const authCodeKey = `auth_code:${authCode}`
  await c.env.KV.put(authCodeKey, JSON.stringify(codeData), { expirationTtl: 600 })

  const redirectUrl = new URL(redirect_uri)
  redirectUrl.searchParams.set('code', authCode)
  if (state) redirectUrl.searchParams.set('state', state)

  return c.redirect(redirectUrl.toString())
})

app.post('/token', async c => {
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

  let authCodeData: {
    code: string
    clientId: string
    redirectUri: string
    scope: string
    userId: string
    expiresAt: string
  } | null = null
  try {
    authCodeData = JSON.parse(authCodeValue) as {
      code: string
      clientId: string
      redirectUri: string
      scope: string
      userId: string
      expiresAt: string
    }
  } catch {
    return c.json(
      { error: 'invalid_grant', error_description: 'Invalid authorization code format' },
      { status: 400 }
    )
  }

  if (authCodeData.clientId !== client_id || authCodeData.redirectUri !== redirect_uri) {
    await c.env.KV.delete(authCodeKey)
    return c.json(
      { error: 'invalid_grant', error_description: 'Authorization code does not match request' },
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

  const userDOStubId = c.env.UserDO.idFromName(`user-${authCodeData.userId}`)
  const userDO = c.env.UserDO.get(userDOStubId) as unknown as UserDO

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
    iss: ISSUER,
    sub: authCodeData.userId,
    aud: client_id,
    exp: now + 3600,
    iat: now,
    jti,
    nonce: code_verifier,
  }

  const accessTokenPayload = {
    iss: ISSUER,
    sub: authCodeData.userId,
    aud: client_id,
    exp: now + 3600,
    iat: now,
    jti,
    scope: authCodeData.scope,
  }

  const { signJWT } = await import('./services/KeyService')
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

app.get('/userinfo', async c => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(
      {
        error: 'invalid_request',
        error_description: 'Authorization header with Bearer token is required',
      },
      { status: 401 }
    )
  }

  const token = authHeader.substring(7)

  const publicKey = await c.env.KV.get('oidc:public_key')
  if (!publicKey) {
    return c.json(
      { error: 'server_error', error_description: 'Public key not available' },
      { status: 500 }
    )
  }

  let payload: Record<string, unknown>
  try {
    const { verifyJWT } = await import('./services/KeyService')
    const result = await verifyJWT(token, publicKey)
    payload = result.payload as Record<string, unknown>
  } catch {
    return c.json(
      { error: 'invalid_token', error_description: 'Invalid access token' },
      { status: 401 }
    )
  }

  if (!payload.sub) {
    return c.json(
      { error: 'invalid_token', error_description: 'Token does not contain subject claim' },
      { status: 401 }
    )
  }

  if (payload.exp && typeof payload.exp === 'number') {
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp < now) {
      return c.json(
        { error: 'invalid_token', error_description: 'Token has expired' },
        { status: 401 }
      )
    }
  }

  const userDOId = `user-${payload.sub as string}`

  const db = c.env.DB
  const credentialResult = await db
    .prepare('SELECT user_id FROM credentials WHERE user_id = ?')
    .bind(userDOId)
    .first()

  if (!credentialResult) {
    return c.json({ error: 'invalid_token', error_description: 'User not found' }, { status: 401 })
  }

  return c.json({
    sub: payload.sub,
    name: payload.name || (payload.sub as string),
    email: payload.email,
  })
})

app.route('/auth', auth)
app.route('/simple', simpleAuth)
app.route('/debug', debug)

export { UserDO }
export default app
