import type { DurableObjectStorage, DurableObjectState } from '@cloudflare/workers-types';

import type { User, Credential, Session, WebAuthnChallenge } from '../../types';
import { generateToken, arrayBufferToBase64Url } from '../services/crypto';

export class UserDurableObject {
  private storage: DurableObjectStorage;
  private state: DurableObjectState;
  private sql: SqlStorage;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.storage = state.storage;
    this.sql = state.storage.sql;

    this.initializeSchema();
  }

  private async initializeSchema(): Promise<void> {
    try {
      await this.sql.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          email TEXT,
          display_name TEXT,
          created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS credentials (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          credential_id TEXT UNIQUE NOT NULL,
          public_key TEXT NOT NULL,
          counter INTEGER NOT NULL DEFAULT 0,
          transports TEXT,
          device_type TEXT NOT NULL,
          backed_up INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          user_agent TEXT,
          ip_address TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS challenges (
          id TEXT PRIMARY KEY,
          challenge TEXT NOT NULL,
          user_id TEXT,
          type TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);
    } catch (error) {
      console.error('Schema initialization error:', error);
    }
  }

  async createUser(username: string, email?: string): Promise<User> {
    const now = Date.now();
    const userId = crypto.randomUUID();

    try {
      await this.sql.exec(`
        INSERT INTO users (id, username, email, created_at)
        VALUES (?, ?, ?, ?)
      `, [userId, username, email || null, now]);
    } catch (error) {
      console.error('Create user error:', error);
      throw error;
    }

    return {
      id: userId,
      username,
      email,
      createdAt: now
    };
  }

  async getUserByUsername(username: string): Promise<User | null> {
    try {
      const cursor = this.sql.exec(`
        SELECT id, username, email, display_name, created_at
        FROM users
        WHERE username = ?
      `, [username]);

      const result = cursor.first();
      if (!result) {
        return null;
      }

      return {
        id: result.id as string,
        username: result.username as string,
        email: result.email as string || undefined,
        displayName: result.display_name as string || undefined,
        createdAt: result.created_at as number
      };
    } catch (error) {
      console.error('Get user by username error:', error);
      return null;
    }
  }

  async getUserById(userId: string): Promise<User | null> {
    try {
      const cursor = this.sql.exec(`
        SELECT id, username, email, display_name, created_at
        FROM users
        WHERE id = ?
      `, [userId]);

      const result = cursor.first();
      if (!result) {
        return null;
      }

      return {
        id: result.id as string,
        username: result.username as string,
        email: result.email as string || undefined,
        displayName: result.display_name as string || undefined,
        createdAt: result.created_at as number
      };
    } catch (error) {
      console.error('Get user by id error:', error);
      return null;
    }
  }

  async registerCredential(
    userId: string,
    credentialId: string,
    publicKey: string,
    counter: number,
    transports: string[],
    deviceType: string,
    backedUp: boolean
  ): Promise<Credential> {
    const now = Date.now();
    const id = crypto.randomUUID();

    await this.sql.exec(`
      INSERT INTO credentials (
        id, user_id, credential_id, public_key, counter,
        transports, device_type, backed_up, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      userId,
      credentialId,
      publicKey,
      counter,
      JSON.stringify(transports),
      deviceType,
      backedUp ? 1 : 0,
      now
    ]);

    return {
      id,
      credentialId,
      publicKey,
      counter,
      transports,
      deviceType,
      backedUp,
      createdAt: now
    };
  }

  async getCredentials(userId: string): Promise<Credential[]> {
    const cursor = this.sql.exec(`
      SELECT
        id, credential_id, public_key, counter,
        transports, device_type, backed_up, created_at
      FROM credentials
      WHERE user_id = ?
    `, [userId]);

    const credentials: Credential[] = [];
    for await (const row of cursor) {
      credentials.push({
        id: row.id as string,
        credentialId: row.credential_id as string,
        publicKey: row.public_key as string,
        counter: row.counter as number,
        transports: row.transports ? JSON.parse(row.transports as string) : undefined,
        deviceType: row.device_type as string,
        backedUp: (row.backed_up as number) === 1,
        createdAt: row.created_at as number
      });
    }

    return credentials;
  }

  async getCredentialById(credentialId: string): Promise<Credential | null> {
    const cursor = this.sql.exec(`
      SELECT
        id, user_id, credential_id, public_key, counter,
        transports, device_type, backed_up, created_at
      FROM credentials
      WHERE credential_id = ?
    `, [credentialId]);

    const result = cursor.first();
    if (!result) {
      return null;
    }

    return {
      id: result.id as string,
      credentialId: result.credential_id as string,
      publicKey: result.public_key as string,
      counter: result.counter as number,
      transports: result.transports ? JSON.parse(result.transports as string) : undefined,
      deviceType: result.device_type as string,
      backedUp: (result.backed_up as number) === 1,
      createdAt: result.created_at as number
    };
  }

  async updateCredentialCounter(credentialId: string, counter: number): Promise<void> {
    await this.sql.exec(`
      UPDATE credentials
      SET counter = ?
      WHERE credential_id = ?
    `, [counter, credentialId]);
  }

  async generateChallenge(
    userId: string | undefined,
    type: 'registration' | 'authentication',
    ttl: number = 300000
  ): Promise<WebAuthnChallenge> {
    const now = Date.now();
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const challenge = arrayBufferToBase64Url(bytes.buffer);
    const id = crypto.randomUUID();

    await this.sql.exec(`
      INSERT INTO challenges (id, challenge, user_id, type, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `, [id, challenge, userId || null, type, now + ttl]);

    return {
      id,
      challenge,
      userId,
      type,
      expiresAt: now + ttl
    };
  }

  async getChallenge(challenge: string): Promise<WebAuthnChallenge | null> {
    const cursor = this.sql.exec(`
      SELECT id, challenge, user_id, type, expires_at
      FROM challenges
      WHERE challenge = ?
    `, [challenge]);

    const result = cursor.first();
    if (!result) {
      return null;
    }

    return {
      id: result.id as string,
      challenge: result.challenge as string,
      userId: result.user_id as string || undefined,
      type: result.type as 'registration' | 'authentication',
      expiresAt: result.expires_at as number
    };
  }

  async deleteChallenge(challenge: string): Promise<void> {
    await this.sql.exec(`
      DELETE FROM challenges
      WHERE challenge = ?
    `, [challenge]);
  }

  async createSession(
    userId: string,
    ttl: number = 86400000
  ): Promise<Session> {
    const now = Date.now();
    const id = crypto.randomUUID();

    await this.sql.exec(`
      INSERT INTO sessions (id, user_id, created_at, expires_at)
      VALUES (?, ?, ?, ?)
    `, [id, userId, now, now + ttl]);

    return {
      id,
      userId,
      createdAt: now,
      expiresAt: now + ttl
    };
  }

  async validateSession(sessionId: string): Promise<Session | null> {
    const now = Date.now();
    const cursor = this.sql.exec(`
      SELECT id, user_id, created_at, expires_at
      FROM sessions
      WHERE id = ?
    `, [sessionId]);

    const result = cursor.first();
    if (!result) {
      return null;
    }

    const expiresAt = result.expires_at as number;
    if (expiresAt < now) {
      await this.deleteSession(sessionId);
      return null;
    }

    return {
      id: result.id as string,
      userId: result.user_id as string,
      createdAt: result.created_at as number,
      expiresAt
    };
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.sql.exec(`
      DELETE FROM sessions
      WHERE id = ?
    `, [sessionId]);
  }

  async deleteAllSessions(userId: string): Promise<void> {
    await this.sql.exec(`
      DELETE FROM sessions
      WHERE user_id = ?
    `, [userId]);
  }

  async cleanupExpiredSessions(): Promise<void> {
    const now = Date.now();
    await this.sql.exec(`
      DELETE FROM sessions
      WHERE expires_at < ?
    `, [now]);
  }

  async cleanupExpiredChallenges(): Promise<void> {
    const now = Date.now();
    await this.sql.exec(`
      DELETE FROM challenges
      WHERE expires_at < ?
    `, [now]);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/cleanup') {
      await this.cleanupExpiredSessions();
      await this.cleanupExpiredChallenges();
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not found', { status: 404 });
  }
}
