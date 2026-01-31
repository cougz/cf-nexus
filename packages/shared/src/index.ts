import { z } from 'zod'

export const UserSchema = z.object({
  id: z.string(),
  username: z.string().min(3).max(50),
  createdAt: z.string().datetime(),
})

export type User = z.infer<typeof UserSchema>

export const OIDCClientSchema = z.object({
  id: z.string(),
  name: z.string(),
  redirectUris: z.array(z.string().url()),
  secret: z.string(),
  scopes: z.array(z.string()).default(['openid', 'profile', 'email']),
})

export type OIDCClient = z.infer<typeof OIDCClientSchema>

export const AuthCodeSchema = z.object({
  code: z.string(),
  userId: z.string(),
  clientId: z.string(),
  redirectUri: z.string(),
  scopes: z.array(z.string()),
  codeChallenge: z.string().optional(),
  codeChallengeMethod: z.enum(['plain', 'S256']).optional(),
  expiresAt: z.number(),
})

export type AuthCode = z.infer<typeof AuthCodeSchema>

export const SessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
})

export type Session = z.infer<typeof SessionSchema>

export const TokenResponseSchema = z.object({
  access_token: z.string(),
  id_token: z.string(),
  token_type: z.literal('Bearer'),
  expires_in: z.number(),
  refresh_token: z.string().optional(),
})

export type TokenResponse = z.infer<typeof TokenResponseSchema>
