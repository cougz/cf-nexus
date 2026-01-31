import type { D1Database, KVNamespace } from '@cloudflare/workers-types';

export interface DurableObjectNamespace {
  get(id: DurableObjectId): DurableObjectStub;
  idFromName(name: string): DurableObjectId;
  idFromString(id: string): DurableObjectId;
}

export interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}

export interface DurableObjectId {
  equals(other: DurableObjectId): boolean;
  toString(): string;
}

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  USER_DO: DurableObjectNamespace;
  JWT_PRIVATE_KEY: string;
  ENVIRONMENT: string;
  ISSUER: string;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  displayName?: string;
  createdAt: number;
}

export interface Credential {
  id: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports?: string[];
  deviceType: string;
  backedUp: boolean;
  createdAt: number;
}

export interface Session {
  id: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
  userAgent?: string;
  ipAddress?: string;
}

export interface WebAuthnChallenge {
  id: string;
  challenge: string;
  userId?: string;
  type: 'registration' | 'authentication';
  expiresAt: number;
}

export interface OIDCClient {
  id: string;
  clientId: string;
  name: string;
  redirectUris: string[];
  allowedScopes: string[];
  allowedGroups?: string[];
  createdAt: number;
}

export interface AuthorizationCode {
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  scope: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  nonce?: string;
  expiresAt: number;
}

export interface JWKS {
  keys: JWKKey[];
}

export interface JWKKey {
  kty: string;
  kid: string;
  use: string;
  alg: string;
  n: string;
  e: string;
}

export interface TokenClaims {
  sub: string;
  aud: string;
  iss: string;
  exp: number;
  iat: number;
  auth_time?: number;
  nonce?: string;
  scope?: string;
}

export interface IDTokenClaims extends TokenClaims {
  name?: string;
  email?: string;
  email_verified?: boolean;
  preferred_username?: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: number;
}

export type OIDCResponseTypes = 'code';
export type OIDCGrantTypes = 'authorization_code' | 'refresh_token';
export type OIDCTokenTypes = 'Bearer';
export type OIDCScopes = 'openid' | 'profile' | 'email';
export type OIDCClaims = 'sub' | 'name' | 'email' | 'email_verified' | 'preferred_username';
