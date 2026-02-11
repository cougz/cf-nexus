import { Hono } from 'hono'
import { getJWKS } from '../services/KeyService'

type Env = {
  Bindings: {
    KV: KVNamespace
    DB: D1Database
  }
}

const oidc = new Hono<Env>()

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

oidc.get('/.well-known/openid-configuration', async c => {
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

oidc.get('/.well-known/jwks.json', async c => {
  const cacheKey = 'oidc:jwks'

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

  const jwks = await getJWKS(process.env.JWT_PRIVATE_KEY || '')

  c.env.KV.put(cacheKey, JSON.stringify(jwks), { expirationTtl: 3600 })

  return c.json(jwks, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
    },
  })
})

export default oidc
