# Nexus OIDC Provider

A Cloudflare-based OIDC authentication provider with WebAuthn (passkey) support.

## Features

- **WebAuthn Authentication** - Passwordless login with passkeys
- **Admin-First Setup** - First user automatically becomes admin
- **OIDC Compliant** - Full OpenID Connect provider implementation
- **Cloudflare Native** - Built on Workers, Pages, D1, KV, and Durable Objects
- **Test-Driven Development** - All code tested before deployment

## Prerequisites

### Required Tools

- **Bun** - JavaScript runtime and package manager
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```

- **Wrangler CLI** - Cloudflare Workers CLI
  ```bash
  bun install -g wrangler
  # Or use bunx: bunx wrangler <command>
  ```

- **Git** - Version control
- **GitHub CLI** - Optional, for monitoring CI/CD
  ```bash
  brew install gh  # macOS
  # Or: https://cli.github.com/
  ```

### Cloudflare Account

You need a Cloudflare account with the following free resources:
- Cloudflare Workers (free tier)
- Cloudflare Pages (free tier)
- D1 Database (free tier)
- KV Storage (free tier)

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/cougz/cf-nexus.git
cd cf-nexus
bun install
```

### 2. Run Tests

```bash
bun test
```

Expected output: All tests passing

### 3. Run Linter

```bash
bun run lint
```

## Cloudflare Infrastructure Setup

### Step 1: Authenticate with Cloudflare

```bash
bunx wrangler login
```

This will open a browser to authorize Wrangler.

### Step 2: Create Databases

Create production and preview D1 databases:

```bash
# Production database
bunx wrangler d1 create nexus-db

# Preview database
bunx wrangler d1 create nexus-db-preview
```

**Copy the `database_id` from each output.**

### Step 3: Create KV Namespaces

Create production and preview KV namespaces:

```bash
# Production KV
bunx wrangler kv namespace create "nexus-api-nexus-kv"

# Preview KV (use --preview flag)
bunx wrangler kv namespace create "nexus-api-preview-nexus-kv-preview" --preview
```

**Copy the `id` from each output.**

### Step 4: Update wrangler.toml

Edit `apps/api/wrangler.toml` and paste the IDs:

```toml
[[env.preview.d1_databases]]
binding = "DB"
database_name = "nexus-db-preview"
database_id = "<PASTE_PREVIEW_DB_ID>"

[[env.preview.kv_namespaces]]
binding = "KV"
id = "<PASTE_PREVIEW_KV_ID>"

[[env.production.d1_databases]]
binding = "DB"
database_name = "nexus-db"
database_id = "<PASTE_PRODUCTION_DB_ID>"

[[env.production.kv_namespaces]]
binding = "KV"
id = "<PASTE_PRODUCTION_KV_ID>"
```

### Step 5: Commit Changes

```bash
git add apps/api/wrangler.toml
git commit -m "chore: populate wrangler.toml with infrastructure IDs"
git push
```

## GitHub Secrets Setup

### 1. Get Cloudflare API Token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use "Custom Token" template
4. Configure permissions:
   - **Account → Workers Scripts → Edit**
   - **Account → D1 → Edit**
   - **Account → Cloudflare Pages → Edit**
   - **Account → KV → Edit**
   - **Account → Account Settings → Read**
5. Create token and **copy it**

### 2. Get Cloudflare Account ID

1. Go to https://dash.cloudflare.com
2. Click on your account name
3. Copy the **Account ID** from the URL or from the sidebar

### 3. Configure GitHub Secrets

1. Go to: `https://github.com/YOUR_USERNAME/cf-nexus/settings/secrets/actions`
2. Click "New repository secret"
3. Add these secrets:

| Secret Name | Value |
|------------|-------|
| `CLOUDFLARE_API_TOKEN` | Your API token from step 1 |
| `CLOUDFLARE_ACCOUNT_ID` | Your account ID from step 2 |
| `JWT_PRIVATE_KEY` | (Optional) RSA private key for JWT signing |

**Note:** JWT_PRIVATE_KEY can be generated later using:
```bash
openssl genrsa -out private.pem 2048
cat private.pem
```

## Deployment

### Automatic Deployment (Recommended)

After setting up infrastructure and GitHub secrets, CI/CD will automatically:

1. Run tests on every push
2. Deploy to preview environment on PRs
3. Deploy to production on `main` branch pushes

Monitor deployments:
```bash
gh run watch
```

### Manual Deployment

Deploy API to Cloudflare Workers:
```bash
cd apps/api

# Preview environment
bunx wrangler deploy --env preview

# Production
bunx wrangler deploy --env production
```

Deploy Web to Cloudflare Pages:
```bash
cd apps/web
bun run build
node fix-routes.mjs
bunx wrangler pages deploy dist --project-name=nexus-web
```

## Local Development

### Run API Locally

```bash
cd apps/api
bun run dev
```

API will be available at `http://localhost:8787`

### Run Web Locally

```bash
cd apps/web
bun run dev
```

Web will be available at `http://localhost:4321`

### Environment Variables

For local development, create `.dev.vars` in `apps/api`:

```bash
# .dev.vars in apps/api
JWT_PRIVATE_KEY=<your-private-key>
```

## Architecture

```
cf-nexus/
├── apps/
│   ├── api/          # Cloudflare Worker (Hono + Durable Objects)
│   └── web/          # Cloudflare Pages (Astro)
├── packages/
│   └── shared/       # Shared TypeScript types & schemas
├── .github/
│   └── workflows/    # CI/CD pipelines
└── *.md             # Documentation
```

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

## Admin User Setup

The first user who registers automatically becomes the **admin**.

### Steps:

1. Visit the deployed web application
2. Enter a username (e.g., `admin`)
3. Click "Sign In with Passkey"
4. Create a passkey using WebAuthn
5. You're now logged in as admin

**Note:** After the first admin is created, registration is closed. Only the admin can add new users (future feature).

## Troubleshooting

### Tests Fail

```bash
# Clear cache and reinstall
rm -rf node_modules bun.lockb
bun install
bun test
```

### CI/CD Fails

Check for these common issues:

1. **Missing GitHub Secrets**
   - Verify all secrets are set in repository settings
   - Check for typos in secret names

2. **Invalid API Token**
   - Token may be expired
   - Regenerate token at Cloudflare dashboard
   - Ensure all required permissions are granted

3. **Infrastructure Not Created**
   - Verify D1 databases exist: `bunx wrangler d1 list`
   - Verify KV namespaces exist: `bunx wrangler kv namespace list`
   - Check `wrangler.toml` has correct IDs

4. **Migration Fails**
   - D1 database ID may be incorrect in `wrangler.toml`
   - Database might be in use by another deployment

### Local Development Issues

**Port already in use:**
```bash
# Kill process on port 8787 (API)
lsof -ti:8787 | xargs kill

# Kill process on port 4321 (Web)
lsof -ti:4321 | xargs kill
```

**Wrangler not authenticated:**
```bash
bunx wrangler logout
bunx wrangler login
```

## Documentation

- **PROJECT_PLAN.md** - Complete implementation specification
- **WEBAUTHN_PLAN.md** - WebAuthn authentication details
- **INFRASTRUCTURE.md** - Detailed infrastructure setup
- **PROGRESS.md** - Project progress and status
- **LOCAL_SETUP.md** - Quick local setup commands

## License

MIT

## Support

For issues and questions:
- Create an issue on GitHub: https://github.com/cougz/cf-nexus/issues
- Check existing documentation in `*.md` files
- Review Cloudflare Workers docs: https://developers.cloudflare.com/workers/
