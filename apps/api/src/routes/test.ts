import { Hono } from 'hono'

const debug = new Hono<{ Bindings: { KV: KVNamespace } }>()

debug.get('/kv', async c => {
  const testData = {
    key: 'test-key',
    value: 'test-value',
    timestamp: new Date().toISOString(),
  }

  await c.env.KV.put(`test:${testData.key}`, JSON.stringify(testData), {
    expirationTtl: 60,
  })

  const retrieved = await c.env.KV.get(`test:${testData.key}`)
  if (!retrieved) {
    return c.json({ error: 'KV test failed' }, { status: 500 })
  }

  return c.json({
    stored: testData,
    retrieved: JSON.parse(retrieved),
  })
})

export default debug
