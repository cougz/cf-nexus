import { Hono } from 'hono'
import { UserDO } from './durable-objects/UserDO'
import auth from './routes/auth'
import authorize from './routes/authorize'
import debug from './routes/debug'
import simpleAuth from './routes/simple-auth'
import token from './routes/token'
import userinfo from './routes/userinfo'

export { UserDO }

type Env = {
  Bindings: {
    DB: D1Database
    KV: KVNamespace
    UserDO: DurableObjectNamespace
  }
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
  const { getJWKS, generateKeyPair } = await import('./services/KeyService')
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

app.route('/simple', simpleAuth)

app.route('/auth', auth)
app.route('/authorize', authorize)
app.route('/debug', debug)
app.route('/simple', simpleAuth)
app.route('/token', token)
app.route('/userinfo', userinfo)

export default app
