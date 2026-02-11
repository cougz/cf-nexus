-- Add test OIDC client for development/testing
INSERT OR IGNORE INTO oidc_clients (id, name, secret, redirect_uris, scopes)
VALUES (
  'test-client',
  'Test OIDC Client',
  'test-secret',
  '["http://localhost:3000/callback", "http://localhost:8080/callback"]',
  '["openid", "profile", "email"]'
);
