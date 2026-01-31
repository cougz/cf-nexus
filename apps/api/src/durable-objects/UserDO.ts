export interface User {
  id: string;
  username: string;
  createdAt: string;
}

export interface Session {
  userId: string;
  token: string;
  expiresAt: string;
}

export interface DurableObjectState {
  storage: {
    put(key: string, value: string): Promise<void>;
    get(key: string): Promise<string | null>;
    delete(key: string): Promise<void>;
    list?(): Promise<{ keys: string[] }>;
  };
  id?: string;
}

export interface Env {
  UserDO: DurableObjectNamespace;
}

export class UserDO implements DurableObject {
  state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async createUser(data: { username: string }) {
    const id = crypto.randomUUID();
    const user = {
      id,
      username: data.username,
      createdAt: new Date().toISOString(),
    };

    await this.state.storage.put(`user:${id}`, JSON.stringify(user));
    return user;
  }

  async getUser(userId: string): Promise<User | null> {
    const data = await this.state.storage.get(`user:${userId}`);
    if (!data) return null;
    return JSON.parse(data);
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const list = await this.state.storage.list?.();
    if (!list) return null;

    for (const key of list.keys) {
      if (key.startsWith('user:')) {
        const data = await this.state.storage.get(key);
        if (data) {
          const user: User = JSON.parse(data);
          if (user.username === username) {
            return user;
          }
        }
      }
    }

    return null;
  }

  async createSession(ttlMs: number = 86400000): Promise<Session> {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    const userId = this.state.id?.split(':')[1] || '';

    const session: Session = {
      userId,
      token,
      expiresAt,
    };

    await this.state.storage.put(`session:${token}`, JSON.stringify(session));
    return session;
  }

  async validateSession(token: string): Promise<Session | null> {
    const data = await this.state.storage.get(`session:${token}`);
    if (!data) return null;

    const session: Session = JSON.parse(data);

    if (new Date(session.expiresAt) < new Date()) {
      await this.state.storage.delete(`session:${token}`);
      return null;
    }

    return session;
  }

  async revokeSession(token: string): Promise<void> {
    await this.state.storage.delete(`session:${token}`);
  }

  async listSessions(): Promise<Session[]> {
    const list = await this.state.storage.list?.();
    if (!list) return [];

    const sessions: Session[] = [];
    for (const key of list.keys) {
      if (key.startsWith('session:')) {
        const data = await this.state.storage.get(key);
        if (data) {
          const session: Session = JSON.parse(data);
          if (new Date(session.expiresAt) >= new Date()) {
            sessions.push(session);
          }
        }
      }
    }

    return sessions;
  }

  async deleteAllSessions(): Promise<void> {
    const list = await this.state.storage.list?.();
    if (!list) return;

    for (const key of list.keys) {
      if (key.startsWith('session:')) {
        await this.state.storage.delete(key);
      }
    }
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const userId = url.pathname.split('/').pop() || '';

    if (!userId) {
      return new Response('Missing user ID', { status: 400 });
    }

    const id = `UserDO:${userId}`;
    const stub = env.UserDO.get(id);

    return stub.fetch(request);
  },
};
