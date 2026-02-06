export interface Credential {
  id: string
  userId: string
  publicKey: string
  transports?: string[]
  counter: number
  createdAt: string
}

export interface CreateCredentialData {
  id: string
  userId: string
  publicKey: string
  transports?: string[]
}

export interface Env {
  DB: D1Database
}

export class DatabaseService {
  private db: D1Database

  constructor(db: D1Database) {
    this.db = db
  }

  async createCredential(data: CreateCredentialData): Promise<Credential> {
    const now = new Date().toISOString()

    const result = await this.db
      .prepare(
        'INSERT INTO credentials (id, user_id, public_key, transports, counter, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .bind(data.id, data.userId, data.publicKey, JSON.stringify(data.transports || []), 0, now)
      .run()

    if (!result.success) {
      throw new Error('Failed to create credential')
    }

    return {
      id: data.id,
      userId: data.userId,
      publicKey: data.publicKey,
      transports: data.transports,
      counter: 0,
      createdAt: now,
    }
  }

  async getCredentialsByUserId(userId: string): Promise<Credential[]> {
    const result = await this.db
      .prepare(
        'SELECT id, user_id, public_key, transports, counter, created_at FROM credentials WHERE user_id = ?'
      )
      .bind(userId)
      .all()

    return (result.results || []).map((row: unknown) => {
      const r = row as Record<string, unknown>
      return {
        id: r.id as string,
        userId: r.user_id as string,
        publicKey: r.public_key as string,
        transports: r.transports ? (JSON.parse(r.transports as string) as string[]) : undefined,
        counter: r.counter as number,
        createdAt: r.created_at as string,
      }
    })
  }

  async getCredentialById(credentialId: string): Promise<Credential | null> {
    const result = await this.db
      .prepare(
        'SELECT id, user_id, public_key, transports, counter, created_at FROM credentials WHERE id = ?'
      )
      .bind(credentialId)
      .first()

    if (!result) {
      return null
    }

    return {
      id: result.id as string,
      userId: result.user_id as string,
      publicKey: result.public_key as string,
      transports: result.transports ? JSON.parse(result.transports as string) : undefined,
      counter: result.counter as number,
      createdAt: result.created_at as string,
    }
  }

  async deleteCredential(credentialId: string): Promise<void> {
    await this.db.prepare('DELETE FROM credentials WHERE id = ?').bind(credentialId).run()
  }

  async deleteCredentialsByUserId(userId: string): Promise<void> {
    await this.db.prepare('DELETE FROM credentials WHERE user_id = ?').bind(userId).run()
  }

  async updateCredentialCounter(credentialId: string, counter: number): Promise<void> {
    await this.db
      .prepare('UPDATE credentials SET counter = ? WHERE id = ?')
      .bind(counter, credentialId)
      .run()
  }
}
