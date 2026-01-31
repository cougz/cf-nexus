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
- **CLOUDFLARE_API_TOKEN**
  - Create at: https://dash.cloudflare.com/profile/api-tokens
  - **Required Permissions:**
    - **Account → Workers Scripts → Edit**
    - **Account → D1 → Edit**
    - **Account → Cloudflare Pages → Edit**
    - **Account → KV → Edit**
    - **Account → User → Read**
    - **Account → Account Settings → Read**
- **CLOUDFLARE_ACCOUNT_ID**
  - Found at: https://dash.cloudflare.com (in URL or profile page)
- **JWT_PRIVATE_KEY** (optional but recommended)
  - RSA private key for JWT signing
  - Can be generated later if needed

