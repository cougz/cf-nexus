import { Hono } from 'hono'
import { UserDO } from './durable-objects/UserDO'
import auth from './routes/auth'

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

app.route('/simple', simpleAuth)

app.route('/auth', auth)

export default app
