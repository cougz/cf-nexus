# WebAuthn & Authentication Refactoring Plan

## Problem Summary

### Current Issues
1. **Mock WebAuthn Verification**: `verifyRegistration()` and `verifyAuthentication()` always return `{ verified: true }`
2. **Unclear User Flow**: Registration and login both happen on `/login` page, no clear distinction
3. **No Registration Guard**: Anyone can register as a new user (no admin-only registration control)

### Desired Behavior

#### Admin (First User) Setup
1. First user (e.g., `tim.seiffert`) enters username on `/login`
2. Clicks "Sign In with Passkey"
3. System detects no user exists with this username
4. Backend returns registration options (for creating new user)
5. Frontend shows WebAuthn passkey creation prompt
6. On successful attestation:
   - User account is created in D1
   - Passkey credential is stored
   - User is logged in (session created)
   - User is marked as admin

#### Subsequent User Registration
1. Admin (or authorized users) visit `/register` page
2. Enter username and click "Register"
3. Create passkey via WebAuthn
4. Backend verifies attestation and creates user

#### Standard Login Flow
1. Existing users visit `/login`
2. Enter username and click "Sign In with Passkey"
3. System detects user exists, returns login options with registered passkeys
4. WebAuthn authenticates
5. Backend verifies assertion and creates session

## Implementation Plan

### Phase 1: Fix WebAuthn Verification (Priority: HIGH)

#### Task 1.1: Install @passwordless-id/webauthn
- Add to `apps/api/package.json`:
  ```json
  "@passwordless-id/webauthn": "^2.1.0"
  ```
- Run `bun install`

#### Task 1.2: Implement Real verifyRegistration()
**File**: `apps/api/src/services/WebAuthnService.ts`

Replace mock with actual verification:
```typescript
import { verifyRegistrationResponse, verifyAuthenticationResponse } from '@passwordless-id/webauthn'

export async function verifyRegistration(
  attestation: unknown,
  options: VerifyRegistrationOptions
): Promise<{ verified: boolean; credentialId?: string }> {
  try {
    const result = await verifyRegistrationResponse(
      attestation as any,
      {
        expectedChallenge: options.challenge,
        expectedOrigin: options.origin,
        expectedRpId: 'nexus',
      }
    )
    return {
      verified: result.verified,
      credentialId: result.credentialId,
    }
  } catch (error) {
    console.error('Registration verification failed:', error)
    return { verified: false }
  }
}
```

#### Task 1.3: Implement Real verifyAuthentication()
**File**: `apps/api/src/services/WebAuthnService.ts`

Replace mock with actual verification:
```typescript
export async function verifyAuthentication(
  assertion: unknown,
  options: VerifyAuthenticationOptions
): Promise<{ verified: boolean }> {
  try {
    const result = await verifyAuthenticationResponse(
      assertion as any,
      {
        expectedChallenge: options.challenge,
        expectedOrigin: options.origin,
        expectedRpId: 'nexus',
      }
    )
    return { verified: result.verified }
  } catch (error) {
    console.error('Authentication verification failed:', error)
    return { verified: false }
  }
}
```

### Phase 2: Implement Admin-First User Creation (Priority: HIGH)

#### Task 2.1: Add Admin Flag to Users Table
**File**: `apps/api/migrations/0005_add_admin_flag.sql`

```sql
-- Add admin flag to mark first user as admin
ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0;
```

#### Task 2.2: Auto-Assign Admin to First User
**File**: `apps/api/src/routes/auth.ts`

Update `/register/verify` endpoint to mark first user as admin:
```typescript
// After creating user
const existingUsers = await db.getAllUsers()
const isFirstUser = existingUsers.length === 0

if (isFirstUser) {
  await db.markUserAsAdmin(user.id)
}
```

#### Task 2.3: Add Auth Guard for Registration
**File**: `apps/api/src/routes/auth.ts`

Add new endpoint for registration with admin check:
```typescript
auth.post('/register/options', async c => {
  // Check if admin exists
  const hasAdmin = await db.hasAdminUser()

  if (!hasAdmin) {
    // Allow registration (this will be admin)
    return c.json(registrationOptions)
  }

  // If admin exists, only registered users can register
  // OR require admin approval
  return c.json(
    { error: { message: 'Registration closed. Contact administrator.' } },
    { status: 403 }
  )
})
```

### Phase 3: Improve Login Flow (Priority: MEDIUM)

#### Task 3.1: Add User Detection to Login Options
**File**: `apps/api/src/routes/auth.ts`

Update `/login/options` to return both registration and login options:
```typescript
auth.post('/login/options', async c => {
  const user = await userDO.getUserByUsername(username)

  if (!user) {
    // New user - return registration options
    const registrationOptions = await generateRegistrationOptions(...)
    return c.json({ action: 'register', ...registrationOptions })
  }

  // Existing user - return authentication options
  const credentials = await db.getCredentialsByUserId(user.id)
  const authenticationOptions = await generateAuthenticationOptions(...)
  return c.json({ action: 'authenticate', ...authenticationOptions })
})
```

#### Task 3.2: Update Frontend to Handle Both Flows
**File**: `apps/web/src/pages/login.astro`

Update client script to handle register vs authenticate:
```javascript
const options = await optionsRes.json()

if (options.action === 'register') {
  // Call navigator.credentials.create() for new user
  const credential = await navigator.credentials.create({
    publicKey: options,  // Contains rp, user, challenge, pubKeyCredParams
  })
  // Send to /auth/register/verify
} else {
  // Call navigator.credentials.get() for existing user
  const credential = await navigator.credentials.get({
    publicKey: options,  // Contains challenge, allowCredentials
  })
  // Send to /auth/login/verify
}
```

### Phase 4: Add Registration Page (Optional, Priority: LOW)

#### Task 4.1: Create Registration Page
**File**: `apps/web/src/pages/register.astro`

- Similar to login page but explicitly for adding new users
- Only accessible to admin (or if no admin exists yet)
- Admin can generate registration tokens for other users

## Testing Plan

### Test 1. Admin First-Time Setup
1. Visit `/login` as `tim.seiffert`
2. Click "Sign In with Passkey"
3. Complete WebAuthn registration
4. Verify:
   - User created in D1
   - Passkey stored in credentials table
   - User is marked as admin
   - Session cookie set
   - Redirect to `/profile` with user info

### Test 2. Existing User Login
1. Log out
2. Visit `/login` as `tim.seiffert`
3. Click "Sign In with Passkey"
4. Complete WebAuthn authentication
5. Verify:
   - Assertion verified successfully
   - Session created
   - Redirect to `/profile`

### Test 3: Registration Protection
1. Log out as admin
2. Try to register as `another.user`
3. Verify:
   - Registration returns 403 Forbidden
   - Error message: "Registration closed"

### Test 4. Invalid Attestation/Assertion
1. Try to send fake attestation data
2. Verify:
   - `verifyRegistration()` returns `{ verified: false }`
   - Server returns 400 error

## Files to Modify

1. **apps/api/src/services/WebAuthnService.ts** - Replace mock verification ✅
2. **apps/api/src/routes/auth.ts** - Add admin logic, user detection ✅
3. **apps/api/src/durable-objects/UserDO.ts** - Add isAdmin flag ✅
4. **apps/api/src/services/DatabaseService.ts** - Add getAllUserIds method ✅
5. **apps/web/src/pages/login.astro** - Handle register vs authenticate flows ✅
6. **apps/api/package.json** - @passwordless-id/webauthn dependency already installed ✅

## Dependencies

- `@passwordless-id/webauthn`: For verifying WebAuthn attestation/assertion ✅
- UserDO isAdmin flag (no migration needed - users stored in Durable Objects) ✅

## Success Criteria

- [x] First user becomes admin automatically
- [x] WebAuthn attestation is actually verified (not mocked)
- [x] WebAuthn assertion is actually verified (not mocked)
- [x] Login flow handles both new and existing users
- [x] Registration is protected after admin exists
- [x] All tests pass with real WebAuthn verification
- [x] No mock code remains in production

## Estimated Time

- Phase 1: 30 minutes (dependency install + 2 verification functions)
- Phase 2: 45 minutes (migration + admin logic)
- Phase 3: 30 minutes (user detection + frontend update)
- Phase 4: 30 minutes (optional registration page)

**Total: ~2 hours** (or 1.5 hours without Phase 4)
