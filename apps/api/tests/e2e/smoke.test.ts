#!/usr/bin/env bun
/**
 * End-to-End Smoke Test for Nexus OIDC Provider
 * Tests the complete authorization code flow
 */

const API_URL = process.env.API_URL || 'https://nexus-api.tim-9c0.workers.dev'

interface TestResult {
  name: string
  passed: boolean
  message: string
  details?: string
}

const results: TestResult[] = []

async function runTests() {
  console.log('🚀 Running Nexus OIDC E2E Smoke Test')
  console.log(`📍 API URL: ${API_URL}`)
  console.log('')

  // Test 1: Health Check
  await test('Health Check', async () => {
    const res = await fetch(`${API_URL}/health`)
    const data = await res.json()
    assert(res.ok, 'Health check should return 200')
    assert(data.status === 'ok', 'Health status should be ok')
    return 'Health endpoint is healthy'
  })

  // Test 2: OIDC Discovery
  await test('OIDC Discovery', async () => {
    const res = await fetch(`${API_URL}/.well-known/openid-configuration`)
    const data = await res.json()
    assert(res.ok, 'Discovery endpoint should return 200')
    assert(data.issuer === API_URL, 'Issuer should match API URL')
    assert(data.authorization_endpoint, 'Should have authorization_endpoint')
    assert(data.token_endpoint, 'Should have token_endpoint')
    assert(data.userinfo_endpoint, 'Should have userinfo_endpoint')
    assert(data.jwks_uri, 'Should have jwks_uri')
    return 'OIDC discovery configuration is valid'
  })

  // Test 3: JWKS Endpoint
  await test('JWKS Endpoint', async () => {
    const res = await fetch(`${API_URL}/.well-known/jwks.json`)
    const data = await res.json()
    assert(res.ok, 'JWKS endpoint should return 200')
    assert(Array.isArray(data.keys), 'Should have keys array')
    assert(data.keys.length > 0, 'Should have at least one key')
    assert(data.keys[0].kty === 'RSA', 'Key type should be RSA')
    assert(data.keys[0].alg === 'RS256', 'Algorithm should be RS256')
    return 'JWKS endpoint returns valid keys'
  })

  // Test 4: Authorization Endpoint - Unauthenticated
  await test('Authorization Endpoint (Unauthenticated)', async () => {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: 'test-client',
      redirect_uri: 'http://localhost:3000/callback',
      scope: 'openid profile email',
      state: 'test123',
    })

    const res = await fetch(`${API_URL}/authorize?${params}`, {
      redirect: 'manual',
    })

    const location = res.headers.get('location')
    assert(res.status === 302, 'Should redirect to login')
    assert(location?.includes('nexus-web'), 'Should redirect to web application')
    return 'Unauthenticated users are redirected to login'
  })

  // Test 5: Token Endpoint - Invalid Code
  await test('Token Endpoint (Invalid Code)', async () => {
    const res = await fetch(`${API_URL}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: 'invalid-code',
        redirect_uri: 'http://localhost:3000/callback',
        client_id: 'test-client',
      }),
    })

    const data = await res.json()
    assert(res.status === 400, 'Should return 400 for invalid code')
    assert(data.error, 'Should return error object')
    return 'Invalid authorization codes are rejected'
  })

  // Test 6: UserInfo Endpoint - Invalid Token
  await test('UserInfo Endpoint (Invalid Token)', async () => {
    const res = await fetch(`${API_URL}/userinfo`, {
      headers: {
        Authorization: 'Bearer invalid-token',
      },
    })

    const data = await res.json()
    assert(res.status === 401, 'Should return 401 for invalid token')
    assert(data.error, 'Should return error object')
    return 'Invalid access tokens are rejected'
  })

  // Test 7: Security Headers
  await test('Security Headers', async () => {
    const res = await fetch(`${API_URL}/health`)
    const headers = res.headers

    assert(
      headers.get('X-Content-Type-Options') === 'nosniff',
      'Should have X-Content-Type-Options'
    )
    assert(headers.get('X-Frame-Options') === 'DENY', 'Should have X-Frame-Options')
    assert(headers.get('X-XSS-Protection') === '1; mode=block', 'Should have X-XSS-Protection')
    assert(
      headers.get('Referrer-Policy') === 'strict-origin-when-cross-origin',
      'Should have Referrer-Policy'
    )
    return 'Security headers are present'
  })

  // Test 8: Token Endpoint Functional
  await test('Token Endpoint Functional', async () => {
    const res = await fetch(`${API_URL}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: 'invalid-code',
        redirect_uri: 'http://localhost:3000/callback',
        client_id: 'test-client',
      }),
    })

    const data = await res.json()
    assert(res.status === 400, 'Should return 400 for invalid code')
    assert(data.error, 'Should return error object')
    return 'Token endpoint handles requests'
  })

  console.log('\n📊 Test Results:')
  console.log('='.repeat(60))

  console.log('\n📊 Test Results:')
  console.log('='.repeat(60))

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length

  for (const result of results) {
    const icon = result.passed ? '✅' : '❌'
    console.log(`${icon} ${result.name}`)
    if (!result.passed) {
      console.log(`   ${result.message}`)
      if (result.details) {
        console.log(`   Details: ${result.details}`)
      }
    }
  }

  console.log('='.repeat(60))
  console.log(`\nTotal: ${results.length} | Passed: ${passed} | Failed: ${failed}`)

  if (failed > 0) {
    process.exit(1)
  }
}

function test(name: string, fn: () => Promise<string>): Promise<void> {
  return fn()
    .then(message => {
      results.push({ name, passed: true, message })
    })
    .catch(err => {
      results.push({
        name,
        passed: false,
        message: err.message || 'Test failed',
        details: err.stack,
      })
    })
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`)
  }
}

runTests().catch(err => {
  console.error('\n❌ Test suite failed:', err)
  process.exit(1)
})
