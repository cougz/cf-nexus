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

const authorize = new Hono<Env>()

authorize.get('/authorize', async c => {
  console.log('[DEBUG] /authorize endpoint called')
  console.log('[DEBUG] Query params:', c.req.query())

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
    .prepare('SELECT id, name, redirect_uris, scopes FROM oidc_clients WHERE id = ?')
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
    loginUrl.searchParams.set('response_type', 'code')
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
      loginUrl.searchParams.set('response_type', 'code')
      return c.redirect(loginUrl.toString())
    }

    user = await userDO.getUser(session.userId)
  } catch {
    const loginUrl = new URL('/login', 'https://nexus-web-7l6.pages.dev')
    loginUrl.searchParams.set('client_id', client_id)
    loginUrl.searchParams.set('redirect_uri', redirect_uri)
    loginUrl.searchParams.set('scope', scope || 'openid profile email')
    if (state) loginUrl.searchParams.set('state', state)
    loginUrl.searchParams.set('response_type', 'code')
    return c.redirect(loginUrl.toString())
  }

  if (!user) {
    const loginUrl = new URL('/login', 'https://nexus-web-7l6.pages.dev')
    loginUrl.searchParams.set('client_id', client_id)
    loginUrl.searchParams.set('redirect_uri', redirect_uri)
    loginUrl.searchParams.set('scope', scope || 'openid profile email')
    if (state) loginUrl.searchParams.set('state', state)
    loginUrl.searchParams.set('response_type', 'code')
    return c.redirect(loginUrl.toString())
  }

  const authCode = crypto.randomUUID()
  const codeData: AuthCode = {
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

export default authorize
