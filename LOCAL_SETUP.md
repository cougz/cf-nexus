# Local Infrastructure Setup

Run these commands on your local machine where wrangler is authenticated.

## Create Production Resources

```bash
# Create production D1 database
bunx wrangler d1 create nexus-db

# Create production KV namespace
bunx wrangler kv namespace create "nexus-api-nexus-kv"
```

## Create Preview Resources

```bash
# Create preview D1 database
bunx wrangler d1 create nexus-db-preview

# Create preview KV namespace
bunx wrangler kv namespace create "nexus-api-preview-nexus-kv-preview" --preview
```

## Copy the IDs

From each command output, copy the IDs:

**From D1 create commands:**
- `database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"`

**From KV create commands:**
- `id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"`

## Update wrangler.toml

Edit `apps/api/wrangler.toml` and add the IDs:

### Production (lines 24-30)
```toml
[[env.production.d1_databases]]
binding = "DB"
database_name = "nexus-db"
database_id = "<PASTE_PRODUCTION_DB_ID>"

[[env.production.kv_namespaces]]
binding = "KV"
id = "<PASTE_PRODUCTION_KV_ID>"
```

### Preview (lines 8-14)
```toml
[[env.preview.d1_databases]]
binding = "DB"
database_name = "nexus-db-preview"
database_id = "<PASTE_PREVIEW_DB_ID>"

[[env.preview.kv_namespaces]]
binding = "KV"
id = "<PASTE_PREVIEW_KV_ID>"
```

## Commit and Push

```bash
git add apps/api/wrangler.toml
git commit -m "chore: populate wrangler.toml with infrastructure IDs"
git push
```

## Verify CI

```bash
gh run watch
```

The CI should now run successfully without any infrastructure setup errors.
