import { describe, expect, it } from 'bun:test'

function createMockKV() {
  const data: Record<string, { value: string; expiration?: number }> = {}

  return {
    data,
    put: async (key: string, value: string, options?: { expirationTtl?: number }) => {
      data[key] = {
        value,
        expiration: options?.expirationTtl ? Date.now() / 1000 + options.expirationTtl : undefined,
      }
    },
    get: async (key: string) => {
      const entry = data[key]
      if (!entry) {
        return null
      }
      if (entry.expiration && entry.expiration < Date.now() / 1000) {
        delete data[key]
        return null
      }
      return entry.value
    },
    delete: async (key: string) => {
      delete data[key]
    },
  }
}

describe('ChallengeService', () => {
  describe('storeChallenge', () => {
    it('should store challenge data', async () => {
      const mockKV = createMockKV()
      const { ChallengeService } = await import('../../src/services/ChallengeService')
      const service = new ChallengeService(mockKV as KVNamespace)

      const challengeData = {
        username: 'testuser',
        challenge: 'challenge-123',
        type: 'registration' as const,
        createdAt: new Date().toISOString(),
      }

      await service.storeChallenge(challengeData)

      expect(mockKV.data['challenge:challenge-123']).toBeDefined()
      expect(mockKV.data['challenge:challenge-123'].value).toBe(JSON.stringify(challengeData))
    })

    it('should set TTL on challenge', async () => {
      const mockKV = createMockKV()
      const { ChallengeService } = await import('../../src/services/ChallengeService')
      const service = new ChallengeService(mockKV as KVNamespace)

      await service.storeChallenge({
        username: 'testuser',
        challenge: 'challenge-123',
        type: 'registration',
        createdAt: new Date().toISOString(),
      })

      const entry = mockKV.data['challenge:challenge-123']
      expect(entry.expiration).toBeDefined()
      expect(entry.expiration).toBeGreaterThan(Date.now() / 1000)
    })
  })

  describe('getChallenge', () => {
    it('should retrieve stored challenge', async () => {
      const mockKV = createMockKV()
      const { ChallengeService } = await import('../../src/services/ChallengeService')
      const service = new ChallengeService(mockKV as KVNamespace)

      const challengeData = {
        username: 'testuser',
        challenge: 'challenge-123',
        type: 'registration' as const,
        createdAt: new Date().toISOString(),
      }

      await service.storeChallenge(challengeData)
      const retrieved = await service.getChallenge('challenge-123')

      expect(retrieved).toEqual(challengeData)
    })

    it('should return null for non-existent challenge', async () => {
      const mockKV = createMockKV()
      const { ChallengeService } = await import('../../src/services/ChallengeService')
      const service = new ChallengeService(mockKV as KVNamespace)

      const retrieved = await service.getChallenge('non-existent')

      expect(retrieved).toBeNull()
    })
  })

  describe('deleteChallenge', () => {
    it('should delete stored challenge', async () => {
      const mockKV = createMockKV()
      const { ChallengeService } = await import('../../src/services/ChallengeService')
      const service = new ChallengeService(mockKV as KVNamespace)

      await service.storeChallenge({
        username: 'testuser',
        challenge: 'challenge-123',
        type: 'registration',
        createdAt: new Date().toISOString(),
      })

      await service.deleteChallenge('challenge-123')

      expect(mockKV.data['challenge:challenge-123']).toBeUndefined()
    })
  })
})
