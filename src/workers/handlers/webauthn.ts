import { Hono } from 'hono';
import { z } from 'zod';

import type { Env } from '../../types';
import { generateRegistrationOptions, generateAuthenticationOptions, verifyRegistration, verifyAuthentication } from '../services/webauthn';
import type { UserDurableObject } from '../durable-objects/user';

const registrationBeginSchema = z.object({
  username: z.string().min(3).max(100)
});

const registrationCompleteSchema = z.object({
  username: z.string(),
  credential: z.any()
});

const authBeginSchema = z.object({
  username: z.string().min(3).max(100)
});

const authCompleteSchema = z.object({
  username: z.string(),
  assertion: z.any()
});

export function createWebAuthnHandlers() {
  const app = new Hono<{ Bindings: Env }>();

  app.post('/register/begin', async (c) => {
    try {
      const body = await c.req.json();

      const { username } = registrationBeginSchema.parse(body);

      const env = c.env;
      const userDOId = env.USER_DO.idFromName(`user:${username}`);
      const userDO = env.USER_DO.get(userDOId) as unknown as UserDurableObject;

      const user = await userDO.getUserByUsername(username);

      const challenge = await userDO.generateChallenge(
        user?.id,
        'registration',
        300000
      );

      const options = generateRegistrationOptions(username, challenge.challenge, user || undefined);

      return c.json({
        challenge: challenge.challenge,
        options,
        isNewUser: !user
      });
    } catch (error) {
      console.error('Registration begin error:', error);
      return c.json({ error: 'Invalid request' }, { status: 400 });
    }
  });

  app.post('/register/complete', async (c) => {
    try {
      const body = await c.req.json();

      const { username, credential } = registrationCompleteSchema.parse(body);

      const env = c.env;
      const userDOId = env.USER_DO.idFromName(`user:${username}`);
      const userDO = env.USER_DO.get(userDOId) as unknown as UserDurableObject;

      const challengeData = await userDO.getChallenge(
        base64UrlToBase64Url(credential.response.clientDataJSON)
      );

      if (!challengeData || challengeData.type !== 'registration') {
        return c.json({ error: 'Invalid or expired challenge' }, { status: 400 });
      }

      const result = await verifyRegistration(credential, challengeData.challenge);

      if (!result.verified) {
        return c.json({ error: 'Registration verification failed' }, { status: 400 });
      }

      let user = await userDO.getUserByUsername(username);
      if (!user) {
        user = await userDO.createUser(username);
      }

      await userDO.registerCredential(
        user.id,
        result.credentialId,
        result.publicKey,
        result.counter,
        result.transports,
        result.deviceType,
        result.backedUp
      );

      await userDO.deleteChallenge(challengeData.challenge);

      return c.json({ success: true, user });
    } catch (error) {
      console.error('Registration complete error:', error);
      return c.json({ error: 'Invalid request' }, { status: 400 });
    }
  });

  app.post('/auth/begin', async (c) => {
    try {
      const body = await c.req.json();

      const { username } = authBeginSchema.parse(body);

      const env = c.env;
      const userDOId = env.USER_DO.idFromName(`user:${username}`);
      const userDO = env.USER_DO.get(userDOId) as unknown as UserDurableObject;

      const user = await userDO.getUserByUsername(username);

      if (!user) {
        return c.json({ error: 'User not found' }, { status: 404 });
      }

      const credentials = await userDO.getCredentials(user.id);

      if (credentials.length === 0) {
        return c.json({ error: 'No credentials registered' }, { status: 400 });
      }

      const challenge = await userDO.generateChallenge(user.id, 'authentication', 300000);

      const options = generateAuthenticationOptions(challenge.challenge, credentials);

      return c.json({
        challenge: challenge.challenge,
        options
      });
    } catch (error) {
      console.error('Auth begin error:', error);
      return c.json({ error: 'Invalid request' }, { status: 400 });
    }
  });

  app.post('/auth/complete', async (c) => {
    try {
      const body = await c.req.json();

      const { username, assertion } = authCompleteSchema.parse(body);

      const env = c.env;
      const userDOId = env.USER_DO.idFromName(`user:${username}`);
      const userDO = env.USER_DO.get(userDOId) as unknown as UserDurableObject;

      const user = await userDO.getUserByUsername(username);

      if (!user) {
        return c.json({ error: 'User not found' }, { status: 404 });
      }

      const challengeData = await userDO.getChallenge(
        base64UrlToBase64Url(assertion.response.clientDataJSON)
      );

      if (!challengeData || challengeData.type !== 'authentication') {
        return c.json({ error: 'Invalid or expired challenge' }, { status: 400 });
      }

      const credentialId = base64UrlToBase64Url(assertion.id);
      const credential = await userDO.getCredentialById(credentialId);

      if (!credential) {
        return c.json({ error: 'Credential not found' }, { status: 404 });
      }

      const result = await verifyAuthentication(assertion, challengeData.challenge, credential);

      if (!result.verified) {
        return c.json({ error: 'Authentication verification failed' }, { status: 400 });
      }

      await userDO.updateCredentialCounter(credentialId, result.counter);
      await userDO.deleteChallenge(challengeData.challenge);

      const session = await userDO.createSession(user.id);

      return c.json({
        success: true,
        sessionId: session.id,
        user: {
          id: user.id,
          username: user.username
        },
        redirect: '/dashboard'
      });
    } catch (error) {
      console.error('Auth complete error:', error);
      return c.json({ error: 'Invalid request' }, { status: 400 });
    }
  });

  return app;
}

function base64UrlToBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
