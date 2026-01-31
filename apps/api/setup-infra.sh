#!/usr/bin/env bash
set -e

# Setup Cloudflare Infrastructure
# This script creates D1 databases and KV namespaces, then updates wrangler.toml with the generated IDs

cd "$(dirname "$0")"

echo "Setting up Cloudflare infrastructure..."

ENV=${1:-preview}
DB_NAME="nexus-db${ENV:+-$ENV}"
KV_NAME="nexus-kv${ENV:+-$ENV}"

echo "Environment: $ENV"
echo "Database Name: $DB_NAME"
echo "KV Name: $KV_NAME"

# Create D1 database
echo "Creating D1 database: $DB_NAME"
DB_OUTPUT=$(wrangler d1 create "$DB_NAME" 2>&1 || true)
DB_ID=$(echo "$DB_OUTPUT" | grep -oE 'database_id = "[^"]+"' | head -1 | cut -d'"' -f2)

if [ -z "$DB_ID" ]; then
  echo "Database may already exist, attempting to list..."
  DB_LIST=$(wrangler d1 list 2>&1 || true)
  DB_ID=$(echo "$DB_LIST" | grep -B5 "$DB_NAME" | grep -oE 'database_id = "[^"]+"' | head -1 | cut -d'"' -f2 || echo "")
fi

if [ -z "$DB_ID" ]; then
  echo "ERROR: Could not find or create database ID for $DB_NAME"
  exit 1
fi

echo "Database ID: $DB_ID"

# Create KV namespace
echo "Creating KV namespace: $KV_NAME"
KV_OUTPUT=$(wrangler kv:namespace create "$KV_NAME" ${ENV:+--preview} 2>&1 || true)
KV_ID=$(echo "$KV_OUTPUT" | grep -oE 'id = "[^"]+"' | head -1 | cut -d'"' -f2)

if [ -z "$KV_ID" ]; then
  echo "KV namespace may already exist, listing namespaces..."
  KV_LIST=$(wrangler kv:namespace list 2>&1 || true)
  KV_ID=$(echo "$KV_LIST" | grep -B5 "$KV_NAME" | grep -oE 'id = "[^"]+"' | head -1 | cut -d'"' -f2 || echo "")
fi

if [ -z "$KV_ID" ]; then
  echo "ERROR: Could not find or create KV namespace ID for $KV_NAME"
  exit 1
fi

echo "KV ID: $KV_ID"

# Update wrangler.toml with the IDs
echo "Updating wrangler.toml with generated IDs..."

if [ "$ENV" = "preview" ]; then
  sed -i "s/database_id = \"\"/database_id = \"$DB_ID\"/" wrangler.toml
  sed -i "s/^\[\[env.preview.kv_namespaces\]\]/[[env.preview.kv_namespaces]]\nbinding = \"KV\"\nid = \"$KV_ID\"/" wrangler.toml || \
    sed -i "/^\[\[env.preview.kv_namespaces\]\]/{n;s/^id = \"\"/id = \"$KV_ID\"/}" wrangler.toml
else
  sed -i "s/database_id = \"\"/database_id = \"$DB_ID\"/" wrangler.toml
  sed -i "s/^\[\[env.production.kv_namespaces\]\]/[[env.production.kv_namespaces]]\nbinding = \"KV\"\nid = \"$KV_ID\"/" wrangler.toml || \
    sed -i "/^\[\[env.production.kv_namespaces\]\]/{n;s/^id = \"\"/id = \"$KV_ID\"/}" wrangler.toml
fi

echo "Infrastructure setup complete!"
echo "D1 Database ID: $DB_ID"
echo "KV Namespace ID: $KV_ID"

# Output IDs as environment variables for CI
echo "DB_ID=$DB_ID" >> $GITHUB_OUTPUT
echo "KV_ID=$KV_ID" >> $GITHUB_OUTPUT
