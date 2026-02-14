# Nexus OIDC Provider

## Quick Start

### Step 1: Deploy API Worker
[![Deploy API to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cougz/cf-nexus/tree/main/apps/api)

Configure your Worker:
- Enter Worker name (e.g., `nexus-api`)
- Cloudflare will auto-provision D1 database and KV namespace
- Deployed to temporary workers.dev URL

### Step 2: Configure Custom Domain (API) - Optional but Recommended
In Cloudflare dashboard, go to **Workers & Pages** → **Worker** → **Settings** → **Triggers** → **Custom Domains**:
- Add custom domain (e.g., `api.yourdomain.com`)
- Update DNS CNAME record

### Step 3: Deploy Web Frontend
[![Deploy Web to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cougz/cf-nexus/tree/main/apps/web)

Configure your Web app:
- Set `PUBLIC_API_URL` environment variable to your Worker's custom domain
  - Example: `https://api.yourdomain.com`
- Deployed to temporary pages.dev URL

### Step 4: Configure Custom Domain (Web) - Optional but Recommended
In Cloudflare dashboard, go to **Workers & Pages** → **Pages** → **Custom Domains**:
- Add custom domain (e.g., `app.yourdomain.com`)
- Update DNS CNAME record

### Step 5: Test
Your web app will now communicate with your API using the custom domains you configured.

A Cloudflare-based OIDC authentication provider with WebAuthn (passkey) support.

## Quick Start

1. Click "Deploy API" button above
2. Configure your Worker:
   - Enter Worker name (e.g., `nexus-api`)
   - Cloudflare will auto-provision D1 database and KV namespace
3. After API deployment, click "Deploy Web" button
4. Configure your Web app:
   - Enter Pages project name (e.g., `nexus-web`)
   - Set `PUBLIC_API_URL` to your Worker's custom domain
     - Example: `https://api.yourdomain.com`
5. Configure custom domains in Cloudflare dashboard (optional but recommended):
   - Add custom domain for Worker (e.g., `api.yourdomain.com`)
   - Add custom domain for Pages (e.g., `app.yourdomain.com`)
   - Update DNS with CNAME records

## Features

- **WebAuthn Authentication** - Passwordless login with passkeys
- **Admin-First Setup** - First user automatically becomes admin
- **OIDC Compliant** - Full OpenID Connect provider implementation
- **Cloudflare Native** - Built on Workers, Pages, D1, KV, and Durable Objects

## API Endpoints

### Authentication
- `POST /auth/login/options` - Get login/register options
- `POST /auth/login/verify` - Verify WebAuthn authentication
- `POST /auth/register/verify` - Verify WebAuthn registration
- `POST /auth/logout` - Logout and clear session

### OIDC
- `GET /.well-known/openid-configuration` - OIDC discovery
- `GET /.well-known/jwks.json` - JWKS public keys
- `GET /authorize` - Authorization endpoint
- `POST /token` - Token endpoint
- `GET /userinfo` - UserInfo endpoint

### Health
- `GET /` - API info
- `GET /health` - Health check

## Architecture

```
cf-nexus/
├── apps/
│   ├── api/          # Cloudflare Worker (Hono + Durable Objects)
│   └── web/          # Cloudflare Pages (Astro)
└── WEBAUTHN_PLAN.md   # Implementation guide
```

## Development

### Local Development
```bash
# Install dependencies
bun install

# Run tests
bun test

# Run linter
bun run lint
```

### Environment Variables
Copy `.dev.vars.example` to `.dev.vars` and add your values for local development.

## License

MIT
