import { Hono } from 'hono'

type Env = {
  Bindings: {
    DB: D1Database
  }
}

const debug = new Hono<Env>()

debug.get('/db', async c => {
  try {
    const result = await c.env.DB.prepare('SELECT 1 as test').first()
    return c.json({ result, success: true })
  } catch (error) {
    return c.json({ error: (error as Error).message, success: false }, { status: 500 })
  }
})

debug.get('/db/insert', async c => {
  try {
    await c.env.DB.prepare('INSERT INTO credentials (id, user_id, public_key) VALUES (?, ?, ?)')
      .bind('test-cred-1', 'user-1', 'public-key')
      .run()
    return c.json({ success: true, message: 'Inserted successfully' })
  } catch (error) {
    return c.json({ error: (error as Error).message, success: false }, { status: 500 })
  }
})

debug.get('/db/select', async c => {
  try {
    const result = await c.env.DB.prepare('SELECT id, user_id FROM credentials WHERE id = ?')
      .bind('test-cred-1')
      .first()
    return c.json({ result, success: true })
  } catch (error) {
    return c.json({ error: (error as Error).message, success: false }, { status: 500 })
  }
})

export default debug
