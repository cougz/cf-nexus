import { describe, expect, it } from 'bun:test'

interface MockStorage {
  data: Record<string, string>
  put: (key: string, value: string) => Promise<void>
  get: (key: string) => Promise<string | null>
  delete: (key: string) => Promise<void>
  list: () => Promise<{ keys: string[] }>
}

function createMockStorage(): MockStorage {
  const data: Record<string, string> = {}

  return {
    data,
    put: async (key: string, value: string) => {
      data[key] = value
    },
    get: async (key: string) => {
      return data[key] || null
    },
    delete: async (key: string) => {
      delete data[key]
    },
    list: async () => {
      return { keys: Object.keys(data) }
    },
  }
}

describe('UserDO', () => {
  describe('createUser', () => {
    it('should create a new user with username', async () => {
      const userDO = await import('../src/durable-objects/UserDO')
      const storage = createMockStorage()
      const state = { storage, id: 'UserDO:test-id' }

      const instance = new userDO.UserDO(state)

      await instance.createUser({
        username: 'testuser',
      })

      const storedKeys = Object.keys(storage.data)
      expect(storedKeys.length).toBeGreaterThan(0)
      expect(storedKeys.some((key: string) => key.startsWith('user:'))).toBe(true)
    })

    it('should store user with generated ID', async () => {
      const userDO = await import('../src/durable-objects/UserDO')
      const storage = createMockStorage()
      const state = { storage, id: 'UserDO:test-id' }

      const instance = new userDO.UserDO(state)

      const user = await instance.createUser({
        username: 'testuser',
      })

      expect(user).toHaveProperty('id')
      expect(user).toHaveProperty('username')
      expect(user.username).toBe('testuser')
      expect(user.createdAt).toBeDefined()

      const storedData = storage.data[`user:${user.id}`]
      expect(storedData).toBeDefined()
      const storedUser = JSON.parse(storedData)
      expect(storedUser.username).toBe('testuser')
    })
  })

  describe('getUser', () => {
    it('should retrieve existing user by ID', async () => {
      const userDO = await import('../src/durable-objects/UserDO')
      const storage = createMockStorage()
      const userData = JSON.stringify({
        id: 'user-123',
        username: 'testuser',
        createdAt: new Date().toISOString(),
      })
      storage.data['user:user-123'] = userData

      const state = { storage, id: 'UserDO:test-id' }
      const instance = new userDO.UserDO(state)

      const user = await instance.getUser('user-123')

      expect(user).toBeDefined()
      expect(user?.username).toBe('testuser')
      expect(user?.id).toBe('user-123')
    })

    it('should return null for non-existent user', async () => {
      const userDO = await import('../src/durable-objects/UserDO')
      const storage = createMockStorage()
      const state = { storage, id: 'UserDO:test-id' }
      const instance = new userDO.UserDO(state)

      const user = await instance.getUser('non-existent')

      expect(user).toBeNull()
    })
  })

  describe('createSession', () => {
    it('should create a new session for user', async () => {
      const userDO = await import('../src/durable-objects/UserDO')
      const storage = createMockStorage()
      const state = { storage, id: 'UserDO:user-123' }
      const instance = new userDO.UserDO(state)

      const session = await instance.createSession(86400000)

      expect(session).toBeDefined()
      expect(session).toHaveProperty('token')
      expect(session).toHaveProperty('expiresAt')
      expect(session).toHaveProperty('userId')
      expect(session.userId).toBe('user-123')

      const storedData = storage.data[`session:${session.token}`]
      expect(storedData).toBeDefined()
    })
  })

  describe('validateSession', () => {
    it('should validate a valid session', async () => {
      const userDO = await import('../src/durable-objects/UserDO')
      const storage = createMockStorage()
      const sessionData = JSON.stringify({
        userId: 'user-123',
        token: 'session-token-abc',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      })
      storage.data['session:session-token-abc'] = sessionData

      const state = { storage, id: 'UserDO:test-id' }
      const instance = new userDO.UserDO(state)

      const session = await instance.validateSession('session-token-abc')

      expect(session).toBeDefined()
      expect(session?.userId).toBe('user-123')
      expect(session?.token).toBe('session-token-abc')
    })

    it('should return null for invalid session', async () => {
      const userDO = await import('../src/durable-objects/UserDO')
      const storage = createMockStorage()
      const state = { storage, id: 'UserDO:test-id' }
      const instance = new userDO.UserDO(state)

      const session = await instance.validateSession('invalid-token')

      expect(session).toBeNull()
    })

    it('should return null for expired session', async () => {
      const userDO = await import('../src/durable-objects/UserDO')
      const storage = createMockStorage()
      const sessionData = JSON.stringify({
        userId: 'user-123',
        token: 'session-token-abc',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      })
      storage.data['session:session-token-abc'] = sessionData

      const state = { storage, id: 'UserDO:test-id' }
      const instance = new userDO.UserDO(state)

      const session = await instance.validateSession('session-token-abc')

      expect(session).toBeNull()
      expect(storage.data['session:session-token-abc']).toBeUndefined()
    })
  })

  describe('revokeSession', () => {
    it('should delete session from storage', async () => {
      const userDO = await import('../src/durable-objects/UserDO')
      const storage = createMockStorage()
      storage.data['session:session-token-abc'] = JSON.stringify({
        userId: 'user-123',
        token: 'session-token-abc',
      })

      const state = { storage, id: 'UserDO:test-id' }
      const instance = new userDO.UserDO(state)

      await instance.revokeSession('session-token-abc')

      expect(storage.data['session:session-token-abc']).toBeUndefined()
    })
  })
})
