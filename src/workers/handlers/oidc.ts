import { Hono } from 'hono';
import { z } from 'zod';

import type { Env } from '../../types';
import { signIdToken, signAccessToken, getJWKS } from '../services/jwt';
import type { UserDurableObject } from '../durable-objects/user';

const discoverySchema = z.object({
  clientId: z.string(),
  redirectUri: z.string().url()
});

const tokenSchema = z.object({
  grantType: z.enum(['authorization_code']),
  code: z.string(),
  redirectUri: z.string().url(),
  clientId: z.string()
});

export function createOIDCHandlers() {
  const app = new Hono<{ Bindings: Env }>();

  app.get('/.well-known/openid-configuration', (c) => {
    const issuer = c.env.ISSUER;

    return c.json({
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`,
      userinfo_endpoint: `${issuer}/userinfo`,
      jwks_uri: `${issuer}/.well-known/jwks.json`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      scopes_supported: ['openid', 'profile', 'email'],
      token_types_supported: ['Bearer'],
      claims_supported: ['sub', 'name', 'email', 'email_verified', 'preferred_username'],
      id_token_signing_alg_values_supported: ['RS256'],
      subject_types_supported: ['public'],
      code_challenge_methods_supported: ['S256']
    });
  });

  app.get('/.well-known/jwks.json', async (c) => {
    const cacheKey = 'jwks';
    const cached = await c.env.KV.get(cacheKey);

    if (cached) {
      return c.json(JSON.parse(cached));
    }

    const jwks = await getJWKS();
    
    await c.env.KV.put(cacheKey, JSON.stringify(jwks), {
      expirationTtl: 86400
    });

    return c.json(jwks);
  });

  app.get('/authorize', async (c) => {
    const { client_id, redirect_uri, response_type, scope, state, nonce, code_challenge, code_challenge_method } = c.req.query();

    if (response_type !== 'code') {
      return c.redirect(302, `${redirect_uri}?error=unsupported_response_type`);
    }

    const sessionCookie = c.req.header('Cookie')?.match(/session=([^;]+)/);
    if (sessionCookie) {
      const sessionId = sessionCookie[1];
      return c.redirect(302, `${redirect_uri}?code=authorized&state=${state}`);
    }

    return c.redirect(302, `/login?redirect=${encodeURIComponent(redirect_uri)}&client_id=${client_id}&scope=${scope}&state=${state}&nonce=${nonce}`);
  });

  app.post('/token', async (c) => {
    try {
      const body = await c.req.json();
      const { grantType, code, redirectUri, clientId } = tokenSchema.parse({
        ...body,
        clientId: body.client_id,
        redirectUri: body.redirect_uri
      });

      const env = c.env;
      
      const authorizationCode = await env.KV.get(`auth_code:${code}`);
      if (!authorizationCode) {
        return c.json({ error: 'invalid_grant', error_description: 'Invalid authorization code' }, { status: 400 });
      }

      const codeData = JSON.parse(authorizationCode);
      
      if (codeData.clientId !== clientId || codeData.redirectUri !== redirectUri) {
        return c.json({ error: 'invalid_grant', error_description: 'Client mismatch' }, { status: 400 });
      }

      const userDOId = env.USER_DO.idFromName(`user:${codeData.username}`);
      const userDO = env.USER_DO.get(userDOId) as unknown as UserDurableObject;
      const user = await userDO.getUserById(codeData.userId);

      if (!user) {
        return c.json({ error: 'invalid_grant', error_description: 'User not found' }, { status: 400 });
      }

      const session = await userDO.createSession(user.id);

      const accessToken = await signAccessToken(user.id, clientId);
      const idToken = await signIdToken(user.id, clientId, codeData.nonce, codeData.scope);

      await env.KV.delete(`auth_code:${code}`);

      return c.json({
        access_token: accessToken,
        id_token: idToken,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: codeData.scope
      });
    } catch (error) {
      console.error('Token error:', error);
      return c.json({ error: 'invalid_request', error_description: 'Invalid request' }, { status: 400 });
    }
  });

  app.get('/userinfo', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'invalid_token' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    try {
      const payload = await getJWKS();
      
      const env = c.env;
      const sessionCookie = c.req.header('Cookie')?.match(/session=([^;]+)/);
      if (!sessionCookie) {
        return c.json({ error: 'invalid_token' }, { status: 401 });
      }

      const sessionId = sessionCookie[1];
      const userDOId = env.USER_DO.idFromName(`session:${sessionId}`);
      const userDO = env.USER_DO.get(userDOId) as unknown as UserDurableObject;
      const session = await userDO.validateSession(sessionId);

      if (!session) {
        return c.json({ error: 'invalid_token' }, { status: 401 });
      }

      const user = await userDO.getUserById(session.userId);

      if (!user) {
        return c.json({ error: 'invalid_token' }, { status: 401 });
      }

      const scope = c.req.header('X-Scope') || 'openid';
      
      const claims: any = {
        sub: user.id
      };

      if (scope.includes('profile')) {
        claims.name = user.displayName || user.username;
        claims.preferred_username = user.username;
      }

      if (scope.includes('email')) {
        claims.email = user.email;
        claims.email_verified = !!user.email;
      }

      return c.json(claims);
    } catch (error) {
      console.error('UserInfo error:', error);
      return c.json({ error: 'invalid_token' }, { status: 401 });
    }
  });

  return app;
}
