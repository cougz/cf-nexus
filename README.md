# Nexus - Passwordless Identity at the Edge

A serverless OpenID Connect (OIDC) identity provider built entirely on Cloudflare's Developer Platform. Nexus provides passwordless authentication using WebAuthn/passkeys and delivers seamless single sign-on (SSO) across applications with sub-100ms global latency.

## Features

- **100% Passwordless** - WebAuthn/FIDO2 passkeys only, no passwords
- **OIDC Compliant** - Authorization Code flow with PKCE
- **Multi-tenant** - Manage multiple OIDC client applications
- **Group-based Access Control** - Organize users and permissions
- **Edge-native** - Deploy globally with automatic scaling
- **Cost-effective** - $5-15/month for 10k users

## Tech Stack

### Frontend (Cloudflare Pages)
- Astro 5.x with SSR
- Modern, responsive UI

### Backend (Cloudflare Workers)
- Hono framework for HTTP routing
- Durable Objects for user state
- D1 database for configuration and audit logs
- Workers KV for global caching
- jose for JWT signing/verification
- @passwordless-id/webauthn for WebAuthn
- zod for validation

### Testing
- Vitest for unit tests
- Playwright for E2E tests
- GitHub Actions for CI/CD

## Prerequisites

- Node.js 18+ and npm
- Cloudflare account (free tier works for development)
- Wrangler CLI installed globally

## Getting Started

### 1. Clone and Install

```bash
git clone https://github.com/cougz/cf-nexus.git
cd cf-nexus
npm install
```

### 2. Cloudflare Setup

Authenticate with Cloudflare:
```bash
npm install -g wrangler
wrangler login
```

Create D1 database:
```bash
wrangler d1 create nexus-db
```

Copy the `database_id` from output and update `wrangler.toml`.

Create KV namespace:
```bash
wrangler kv:namespace create KV
```

Copy the `id` from output and update `wrangler.toml`.

Generate JWT signing keys:
```bash
npm run keys:generate
```

Copy the **Private Key** and store as a secret:
```bash
wrangler secret put JWT_PRIVATE_KEY
```

Paste the entire Private Key (including `-----BEGIN` and `-----END` lines).

### 3. Run Database Migrations

Local development:
```bash
npm run db:migrate
```

Production:
```bash
npm run db:migrate:prod
```

### 4. Development & Testing

**Using Bun:**

```bash
bun install
bun run dev
bun run test:unit
bun run test:e2e
```

**Or with npm:**

```bash
npm install
npm run dev
npm run test:unit
npm run typecheck
```

**Testing Cycle:**

1. Run typecheck: `npm run typecheck`
2. Run unit tests: `npm run test:unit`
3. Start dev server: `npm run dev`
4. Run E2E tests in another terminal: `npm run test:e2e`

**Before committing or pushing to main:**

- Ensure `npm run typecheck` passes without errors
- Ensure `npm run test:unit` passes
- Run E2E tests to verify functionality
- CI/CD will run these checks automatically on pull requests

### 2. Cloudflare Setup

Authenticate with Cloudflare:
```bash
npm install -g wrangler
wrangler login
```

Create D1 database:
```bash
wrangler d1 create nexus-db
```

Copy the `database_id` from the output and update `wrangler.toml`.

Create KV namespace:
```bash
wrangler kv:namespace create KV
```

Copy the `id` from the output and update `wrangler.toml`.

### 3. Run Database Migrations

Local development:
```bash
npm run db:migrate
```

Production:
```bash
npm run db:migrate:prod
```

### 4. Generate JWT Keys

Generate RSA key pair:
```bash
node -e "
  const crypto = require('crypto');
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  console.log('Private Key:', privateKey);
  console.log('Public Key:', publicKey);
"
```

Store the private key as a secret:
```bash
wrangler secret put JWT_PRIVATE_KEY
```

Paste the private key when prompted (entire PEM block).

### 5. Development

Start the development server:
```bash
npm run dev
```

Visit http://localhost:8788 to see the application.

## Project Structure

```
cf-nexus/
├── src/
│   ├── pages/              # Astro pages
│   ├── layouts/            # Astro layouts
│   ├── components/         # Astro components
│   ├── workers/            # Workers backend
│   │   ├── index.ts        # Main worker entry
│   │   ├── durable-objects/
│   │   ├── handlers/       # HTTP handlers
│   │   ├── services/       # Business logic
│   │   └── middleware/     # Middleware
│   └── types.ts            # Shared types
├── tests/
│   ├── unit/               # Unit tests
│   └── e2e/                # E2E tests
├── migrations/             # Database migrations
└── package.json
```

## Testing

Run unit tests:
```bash
npm run test:unit
```

Run E2E tests:
```bash
npm run test:e2e
```

Run with coverage:
```bash
npm run test:coverage
```

## Deployment

Build for production:
```bash
npm run build
```

Deploy to Cloudflare Pages:
```bash
npm run deploy
```

## CI/CD

The project uses GitHub Actions for automated testing and deployment. On every push to `main`, the following happens:

1. Run linter
2. Run typecheck
3. Run unit tests
4. Run E2E tests
5. Build the application
6. Deploy to production

## Required GitHub Secrets

Configure these in your repository settings:

- `CLOUDFLARE_API_TOKEN` - Cloudflare API token
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test:unit` - Run unit tests
- `npm run test:e2e` - Run E2E tests
- `npm run lint` - Run linter
- `npm run typecheck` - Run TypeScript typecheck
- `npm run deploy` - Deploy to production

## Environment Variables

- `ENVIRONMENT` - `development`, `staging`, or `production`
- `ISSUER` - OIDC issuer URL
- `JWT_PRIVATE_KEY` - Private key for signing JWTs (secret)

## OIDC Endpoints

- `GET /.well-known/openid-configuration` - Discovery document
- `GET /.well-known/jwks.json` - JWKS public keys
- `GET /authorize` - Authorization endpoint
- `POST /token` - Token endpoint
- `GET /userinfo` - UserInfo endpoint
- `POST /introspect` - Token introspection
- `GET /logout` - Logout

## License

MIT License - see LICENSE file for details
