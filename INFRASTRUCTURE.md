# Infrastructure Setup

## Cloudflare Resources

### Production
- **D1 Database**: nexus-db (ID will be populated by CI)
- **KV Namespace**: nexus-kv (ID will be populated by CI)
- **Durable Objects**: UserDO

### Preview
- **D1 Database**: nexus-db-preview (ID will be populated by CI)
- **KV Namespace**: nexus-kv-preview (ID will be populated by CI)

## Secrets

The following GitHub secrets are required for CI/CD:
- CLOUDFLARE_API_TOKEN
- CLOUDFLARE_ACCOUNT_ID
- JWT_PRIVATE_KEY (optional)

