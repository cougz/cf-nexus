import { Hono } from 'hono'
import { verifyJWT } from '../services/KeyService'

type Env = {
  Bindings: {
    DB: D1Database
    KV: KVNamespace
  }
}

const userinfo = new Hono<Env>()

userinfo.get('/userinfo', async c => {
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

export default userinfo
