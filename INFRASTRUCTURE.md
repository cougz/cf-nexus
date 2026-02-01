# Infrastructure Setup

This document describes the manual infrastructure setup process for Project Nexus. The CI/CD pipeline expects all infrastructure IDs to be pre-populated in `wrangler.toml` before deployment.

## Prerequisites

Before setting up infrastructure, ensure you have:
- A Cloudflare account
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) installed
- Authentication configured: `bunx wrangler login` or `CLOUDFLARE_API_TOKEN` environment variable

## Cloudflare Resources to Create

### Production Resources
- **D1 Database**: nexus-db
- **KV Namespace**: nexus-api-nexus-kv (note the project name prefix)

### Preview Resources
- **D1 Database**: nexus-db-preview
- **KV Namespace**: nexus-api-preview-nexus-kv-preview (note the project name prefix and --preview flag)

## Step-by-Step Manual Setup

### Step 1: Check Existing Resources (Optional)

List existing D1 databases:
```bash
bunx wrangler d1 list
```

List existing KV namespaces:
```bash
bunx wrangler kv namespace list
```

### Step 2: Clean Up Existing Resources (Recommended)

If you want a clean slate, delete existing resources:

Delete D1 databases:
```bash
bunx wrangler d1 delete nexus-db --yes
bunx wrangler d1 delete nexus-db-preview --yes
```

Delete KV namespaces (get namespace IDs from the list command first):
```bash
bunx wrangler kv namespace delete <NAMESPACE_ID>
bunx wrangler kv namespace delete <PREVIEW_NAMESPACE_ID>
```

### Step 3: Create Production Resources

Create production D1 database:
```bash
bunx wrangler d1 create nexus-db
```

Expected output:
```
✨ Successfully created DB 'nexus-db'
[[d1_databases]]
binding = "DB"
database_name = "nexus-db"
database_id = "<COPY_THIS_ID>"
```

Create production KV namespace:
```bash
bunx wrangler kv namespace create "nexus-api-nexus-kv"
```

Expected output:
```
🌀 Creating namespace with title "nexus-api-nexus-kv"
[[kv_namespaces]]
binding = "KV"
id = "<COPY_THIS_ID>"
preview_id = "<IGNORE_FOR_PRODUCTION>"
```

### Step 4: Create Preview Resources

Create preview D1 database:
```bash
bunx wrangler d1 create nexus-db-preview
```

Expected output:
```
✨ Successfully created DB 'nexus-db-preview'
[[d1_databases]]
binding = "DB"
database_name = "nexus-db-preview"
database_id = "<COPY_THIS_ID>"
```

Create preview KV namespace:
```bash
bunx wrangler kv namespace create "nexus-api-preview-nexus-kv-preview" --preview
```

Expected output:
```
🌀 Creating namespace with title "nexus-api-preview-nexus-kv-preview"
[[kv_namespaces]]
binding = "KV"
id = "<COPY_THIS_ID>"
```

### Step 5: Update wrangler.toml

Copy the generated IDs and update `apps/api/wrangler.toml`:

**For Production:**
```toml
[env.production]
name = "nexus-api"

[[env.production.d1_databases]]
binding = "DB"
database_name = "nexus-db"
database_id = "<PASTE_PRODUCTION_DB_ID>"

[[env.production.kv_namespaces]]
binding = "KV"
id = "<PASTE_PRODUCTION_KV_ID>"
```

**For Preview:**
```toml
[env.preview]
name = "nexus-api-preview"

[[env.preview.d1_databases]]
binding = "DB"
database_name = "nexus-db-preview"
database_id = "<PASTE_PREVIEW_DB_ID>"

[[env.preview.kv_namespaces]]
binding = "KV"
id = "<PASTE_PREVIEW_KV_ID>"
```

### Step 6: Commit and Push

Commit the updated wrangler.toml:
```bash
git add apps/api/wrangler.toml
git commit -m "chore: populate wrangler.toml with infrastructure IDs"
git push
```

### Step 7: Verify CI Deployment

Monitor the CI workflow:
```bash
gh run watch
```

Expected CI behavior:
1. Tests run successfully
2. D1 migrations apply to both databases
3. API deploys to Cloudflare Workers
4. Web deploys to Cloudflare Pages

## Troubleshooting

### Error: "A database with that name already exists"
The database already exists in your Cloudflare account. You can either:
- Delete it using `bunx wrangler d1 delete nexus-db --yes` and recreate
- Use `bunx wrangler d1 list` to get the existing ID and manually add it to wrangler.toml

### Error: "A namespace with this account ID and title already exists"
The KV namespace already exists. You can either:
- Delete it using `bunx wrangler kv namespace list` to get the ID, then `bunx wrangler kv namespace delete <ID>`
- Use `bunx wrangler kv namespace list` to get the existing ID and manually add it to wrangler.toml

### Migrations fail after setup
Ensure the D1 database IDs are correctly set in wrangler.toml before the migration step runs in CI.

### Wrangler command not found
Install Wrangler:
```bash
bun install -D wrangler
```

Or use bunx:
```bash
bunx wrangler <command>
```

## GitHub Secrets

The following GitHub secrets are required for CI/CD:
- **CLOUDFLARE_API_TOKEN**
  - Create at: https://dash.cloudflare.com/profile/api-tokens
  - **Required Permissions:**
    - **Account → Workers Scripts → Edit**
    - **Account → D1 → Edit**
    - **Account → Cloudflare Pages → Edit**
    - **Account → KV → Edit**
    - **Account → Account Settings → Read**
  - **Note:** If CI fails with error code 10001, the token may be expired or invalid. Generate a new token.
- **CLOUDFLARE_ACCOUNT_ID**
  - Found at: https://dash.cloudflare.com (in URL or profile page)
- **JWT_PRIVATE_KEY** (optional but recommended)
  - RSA private key for JWT signing
  - Can be generated later if needed

## CI/CD Workflow

The `.github/workflows/ci.yml` workflow now assumes all infrastructure IDs are pre-populated in `wrangler.toml`. It will:

1. Run tests
2. Apply D1 migrations to both preview and production databases
3. Deploy API to Cloudflare Workers
4. Deploy Web to Cloudflare Pages

The workflow does NOT create infrastructure resources - that must be done manually using this guide.

