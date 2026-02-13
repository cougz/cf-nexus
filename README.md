# Nexus OIDC Provider

[![Deploy API to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cougz/cf-nexus/tree/main/apps/api)
[![Deploy Web to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cougz/cf-nexus/tree/main/apps/web)

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
