import { beforeEach, describe, expect, it } from 'bun:test'

interface MockD1Result {
  success?: boolean
  results?: unknown[]
  meta?: unknown
}

interface CredentialData {
  id: string
  user_id: string
  public_key: string
  transports: string
  counter: number
  created_at: string
}

function createMockD1() {
  const data: Record<string, CredentialData> = {}

  return {
    data,
    prepare: (sql: string) => ({
      bind: (...params: unknown[]) => {
        return {
          run: async (): Promise<MockD1Result> => {
            if (sql.includes('INSERT INTO credentials')) {
              const id = params[0] as string
              data[id] = {
                id,
                user_id: params[1] as string,
                public_key: params[2] as string,
                transports: params[3] as string,
                counter: params[4] as number,
                created_at: params[5] as string,
              }
              return { success: true }
            }
            if (sql.includes('UPDATE credentials')) {
              const credentialId = params[1] as string
              if (data[credentialId]) {
                data[credentialId].counter = params[0] as number
              }
              return { success: true }
            }
            if (sql.includes('DELETE FROM credentials WHERE id')) {
              const id = params[0] as string
              delete data[id]
              return { success: true }
            }
            if (sql.includes('DELETE FROM credentials WHERE user_id')) {
              const userId = params[0] as string
              for (const key in data) {
                if (data[key].user_id === userId) {
                  delete data[key]
                }
              }
              return { success: true }
            }
            return { success: true }
          },
          all: async (): Promise<MockD1Result> => {
            if (sql.includes('WHERE user_id = ?')) {
              const userId = params[0] as string
              const results = Object.values(data).filter(item => item.user_id === userId)
              return { results }
            }
            return { results: [] }
          },
          first: async (): Promise<unknown> => {
            if (sql.includes('WHERE id = ?')) {
              const id = params[0] as string
              return data[id] || null
            }
            return null
          },
        }
      },
    }),
  }
}

describe('DatabaseService', () => {
  let db: DatabaseService
  let mockD1: ReturnType<typeof createMockD1>

  beforeEach(async () => {
    mockD1 = createMockD1()
    const { DatabaseService: DBService } = await import('../../src/services/DatabaseService')
    db = new DBService(mockD1 as D1Database)
  })

  describe('createCredential', () => {
    it('should create a new credential', async () => {
      const credential = await db.createCredential({
        id: 'cred-123',
        userId: 'user-123',
        publicKey: 'public-key-here',
        transports: ['internal', 'hybrid'],
      })

      expect(credential).toBeDefined()
      expect(credential.id).toBe('cred-123')
      expect(credential.userId).toBe('user-123')
      expect(credential.publicKey).toBe('public-key-here')
      expect(credential.transports).toEqual(['internal', 'hybrid'])
      expect(credential.counter).toBe(0)
      expect(credential.createdAt).toBeDefined()
    })

    it('should store credential in database', async () => {
      await db.createCredential({
        id: 'cred-123',
        userId: 'user-123',
        publicKey: 'public-key-here',
      })

      expect(mockD1.data['cred-123']).toBeDefined()
      expect(mockD1.data['cred-123'].user_id).toBe('user-123')
    })
  })

  describe('getCredentialsByUserId', () => {
    it('should return empty array for user with no credentials', async () => {
      const credentials = await db.getCredentialsByUserId('user-123')

      expect(credentials).toEqual([])
    })

    it('should return all credentials for user', async () => {
      await db.createCredential({
        id: 'cred-1',
        userId: 'user-123',
        publicKey: 'key-1',
      })
      await db.createCredential({
        id: 'cred-2',
        userId: 'user-123',
        publicKey: 'key-2',
      })
      await db.createCredential({
        id: 'cred-3',
        userId: 'user-456',
        publicKey: 'key-3',
      })

      const credentials = await db.getCredentialsByUserId('user-123')

      expect(credentials.length).toBe(2)
      expect(credentials.map(c => c.id)).toEqual(['cred-1', 'cred-2'])
    })
  })

  describe('getCredentialById', () => {
    it('should return null for non-existent credential', async () => {
      const credential = await db.getCredentialById('non-existent')

      expect(credential).toBeNull()
    })

    it('should return credential by ID', async () => {
      await db.createCredential({
        id: 'cred-123',
        userId: 'user-123',
        publicKey: 'public-key',
        transports: ['internal'],
      })

      const credential = await db.getCredentialById('cred-123')

      expect(credential).not.toBeNull()
      expect(credential?.id).toBe('cred-123')
      expect(credential?.publicKey).toBe('public-key')
      expect(credential?.transports).toEqual(['internal'])
    })
  })

  describe('deleteCredential', () => {
    it('should delete credential from database', async () => {
      await db.createCredential({
        id: 'cred-123',
        userId: 'user-123',
        publicKey: 'key',
      })

      await db.deleteCredential('cred-123')

      expect(mockD1.data['cred-123']).toBeUndefined()
    })
  })

  describe('deleteCredentialsByUserId', () => {
    it('should delete all credentials for user', async () => {
      await db.createCredential({
        id: 'cred-1',
        userId: 'user-123',
        publicKey: 'key-1',
      })
      await db.createCredential({
        id: 'cred-2',
        userId: 'user-123',
        publicKey: 'key-2',
      })
      await db.createCredential({
        id: 'cred-3',
        userId: 'user-456',
        publicKey: 'key-3',
      })

      await db.deleteCredentialsByUserId('user-123')

      expect(mockD1.data['cred-1']).toBeUndefined()
      expect(mockD1.data['cred-2']).toBeUndefined()
      expect(mockD1.data['cred-3']).toBeDefined()
    })
  })

  describe('updateCredentialCounter', () => {
    it('should update credential counter', async () => {
      await db.createCredential({
        id: 'cred-123',
        userId: 'user-123',
        publicKey: 'key',
      })

      await db.updateCredentialCounter('cred-123', 42)

      expect(mockD1.data['cred-123'].counter).toBe(42)
    })
  })
})
