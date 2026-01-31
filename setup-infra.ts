#!/usr/bin/env bun

import { execSync } from 'node:child_process'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'

const env = process.argv[2] || 'preview'
const dbName = env === 'production' ? 'nexus-db' : 'nexus-db-preview'
const kvName = env === 'production' ? 'nexus-kv' : 'nexus-kv-preview'

console.log(`Setting up infrastructure for ${env} environment...`)
console.log(`Database: ${dbName}`)
console.log(`KV: ${kvName}`)

function runCommand(cmd: string, cwd = 'apps/api'): string {
  try {
    const output = execSync(cmd, {
      cwd,
      encoding: 'utf-8',
      env: {
        ...process.env,
        CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
      },
    })
    return output
  } catch (error: any) {
    console.log(`Command failed (may be expected): ${cmd}`)
    console.log(error.stdout || '')
    console.log(error.stderr || '')
    return ''
  }
}

console.log('\nAttempting to create D1 database...')
const dbCreateOutput = runCommand(`bunx wrangler d1 create ${dbName}`)
let dbId = ''

if (dbCreateOutput.includes('database_id =')) {
  const match = dbCreateOutput.match(/database_id = "([^"]+)"/)
  if (match) {
    dbId = match[1]
    console.log(`✓ Created database: ${dbName} (${dbId})`)
  }
}

if (!dbId) {
  console.log('\nTrying to find existing database...')
  const listOutput = runCommand('bunx wrangler d1 list')
  const lines = listOutput.split('\n')
  for (const line of lines) {
    if (line.includes(dbName)) {
      const match = line.match(/database_id = "([^"]+)"/)
      if (match) {
        dbId = match[1]
        console.log(`✓ Found existing database: ${dbName} (${dbId})`)
        break
      }
    }
  }
}

if (!dbId) {
  console.error('\n✗ ERROR: Could not find or create database ID')
  process.exit(1)
}

console.log('\nAttempting to create KV namespace...')
const kvCreateOutput = runCommand(
  `bunx wrangler kv:namespace create ${kvName} ${env === 'preview' ? '--preview' : ''}`
)
let kvId = ''

if (kvCreateOutput.includes('id =')) {
  const match = kvCreateOutput.match(/id = "([^"]+)"/)
  if (match) {
    kvId = match[1]
    console.log(`✓ Created KV namespace: ${kvName} (${kvId})`)
  }
}

if (!kvId) {
  console.log('\nTrying to find existing KV namespace...')
  const listOutput = runCommand('bunx wrangler kv:namespace list')
  const lines = listOutput.split('\n')
  for (const line of lines) {
    if (line.includes(kvName)) {
      const match = line.match(/id = "([^"]+)"/)
      if (match) {
        kvId = match[1]
        console.log(`✓ Found existing KV namespace: ${kvName} (${kvId})`)
        break
      }
    }
  }
}

if (!kvId) {
  console.error('\n✗ ERROR: Could not find or create KV namespace ID')
  process.exit(1)
}

console.log('\nUpdating wrangler.toml...')
let toml = readFileSync('apps/api/wrangler.toml', 'utf-8')

const dbSection = env === 'production' ? 'env.production' : 'env.preview'
const dbPattern = new RegExp(
  `\\[\\[${dbSection}\\.d1_databases\\]\\]\\s*binding = "DB"\\s*database_name = "${dbName}"\\s*database_id = ""`,
  'g'
)
toml = toml.replace(
  dbPattern,
  `[[${dbSection}.d1_databases]]\nbinding = "DB"\ndatabase_name = "${dbName}"\ndatabase_id = "${dbId}"`
)

const kvPattern = new RegExp(
  `\\[\\[${dbSection}\\.kv_namespaces\\]\\]\\s*binding = "KV"\\s*id = ""`,
  'g'
)
toml = toml.replace(kvPattern, `[[${dbSection}.kv_namespaces]]\nbinding = "KV"\nid = "${kvId}"`)

writeFileSync('apps/api/wrangler.toml', toml)
console.log('✓ Updated wrangler.toml')

console.log('\n=== Infrastructure IDs ===')
console.log(`D1 Database: ${dbName} = ${dbId}`)
console.log(`KV Namespace: ${kvName} = ${kvId}`)
console.log('===\n')

if (process.env.GITHUB_OUTPUT) {
  const outputs = `db_id=${dbId}\nkv_id=${kvId}\n`
  appendFileSync(process.env.GITHUB_OUTPUT, outputs)
}
