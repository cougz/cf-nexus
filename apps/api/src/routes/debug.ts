import { Hono } from 'hono'
import { ChallengeService } from '../services/ChallengeService'

type Env = {
  Bindings: {
    KV: KVNamespace
  }
}

const debug = new Hono<Env>()

debug.get('/test-kv', async c => {
  const kv = c.env.KV
  const testKey = 'test-key'
  const testValue = JSON.stringify({ message: 'test', timestamp: new Date().toISOString() })

  try {
    await kv.put(testKey, testValue, { expirationTtl: 300 })
    console.log('Stored test key in KV')
  } catch (error: unknown) {
    console.error('Error storing in KV:', error)
    return c.json(
      {
        error: 'Failed to store in KV',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }

  try {
    const retrieved = await kv.get(testKey)
    if (!retrieved) {
      return c.json({ error: 'Failed to retrieve from KV', key: testKey }, { status: 500 })
    }
    console.log('Retrieved test key from KV:', retrieved)
    return c.json({ success: true, retrieved })
  } catch (error: unknown) {
    console.error('Error retrieving from KV:', error)
    return c.json(
      {
        error: 'Failed to retrieve from KV',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
})

debug.get('/get-challenge', async c => {
  const challenge = c.req.query('challenge')
  const challengeService = new ChallengeService(c.env.KV)
  const challengeData = await challengeService.getChallenge(challenge || '')
  return c.json({ challenge, challengeData })
})

export default debug
