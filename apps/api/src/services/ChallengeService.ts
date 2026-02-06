export interface ChallengeData {
  username: string
  challenge: string
  type: 'registration' | 'authentication'
  credentialIds?: string[]
  createdAt: string
}

export interface Env {
  KV: KVNamespace
}

export class ChallengeService {
  private kv: KVNamespace
  private readonly TTL = 300

  constructor(kv: KVNamespace) {
    this.kv = kv
  }

  async storeChallenge(challengeData: ChallengeData): Promise<void> {
    const key = `challenge:${challengeData.challenge}`
    const value = JSON.stringify(challengeData)
    await this.kv.put(key, value, { expirationTtl: this.TTL })
  }

  async getChallenge(challenge: string): Promise<ChallengeData | null> {
    const key = `challenge:${challenge}`
    const value = await this.kv.get(key)
    if (!value) {
      return null
    }
    return JSON.parse(value) as ChallengeData
  }

  async deleteChallenge(challenge: string): Promise<void> {
    const key = `challenge:${challenge}`
    await this.kv.delete(key)
  }
}
