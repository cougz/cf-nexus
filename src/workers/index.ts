import { Hono } from 'hono';
import { cors } from 'hono/cors';

import type { Env } from '../types';
import { createWebAuthnHandlers } from './handlers/webauthn';
import { createOIDCHandlers } from './handlers/oidc';
import { UserDurableObject } from './durable-objects/user';

export const app = new Hono<{ Bindings: Env }>();

app.use('*', cors());

app.get('/', (c) => {
  return c.json({
    name: 'Nexus',
    version: '0.1.0',
    description: 'Passwordless Identity at the Edge',
    status: 'healthy'
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'healthy' });
});

app.route('/webauthn', createWebAuthnHandlers());

const oidcApp = createOIDCHandlers();
app.route('/authorize', oidcApp);
app.route('/token', oidcApp);
app.route('/userinfo', oidcApp);
app.route('/.well-known', oidcApp);

export { UserDurableObject };

export default {
  fetch: app.fetch
};
