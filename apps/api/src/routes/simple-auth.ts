import { Hono } from 'hono'
import { DatabaseService } from '../services/DatabaseService'

type Env = {
  Bindings: {
    DB: D1Database
  }
}

const simpleAuth = new Hono<Env>()

simpleAuth.post('/register', async c => {
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

  const db = new DatabaseService(c.env.DB)

  try {
    await db.createCredential({
      id: `cred-${Date.now()}`,
      userId: 'user-123',
      publicKey: 'test-public-key',
      transports: ['internal'],
    })
    return c.json({ success: true, message: 'User registered' })
  } catch {
    return c.json(
      { error: { message: 'Registration failed', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    )
  }
})

export default simpleAuth
