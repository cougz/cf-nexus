# Project Nexus: Implementation Specification

## 1. Agent Protocol & Constraints

**Strictly adhere to following rules during implementation:**

* **Role:** Senior Cloudflare Developer & Systems Architect.
* **Runtime:** Use **Bun** (`bun`, `bunx`, `bun test`) exclusively. Do not use `npm` or `node`.
* **Methodology:** **Test-Driven Development (TDD)**. Write a failing test *before* the implementation logic for every single block of code.
* **Version Control:** Commit changes after **every** individual task within a milestone. Message format: `feat(scope): description`.
* **Deployment & Testing:**
  * **Local:** Do **not** deploy locally. Use local dev servers (`wrangler dev`) only for development loop.
  * **CI/CD:** All deployments (Preview & Production) and definitive testing must run via **GitHub Actions**.
  * **Verification:** After pushing code, verify workflow status using `gh` CLI (`gh run watch`, `gh run view`).


* **Infrastructure:**
  * **Frontend:** Cloudflare Pages (Astro Framework).
  * **Backend:** Cloudflare Workers (Hono), D1 (SQL), KV (Cache), Durable Objects (Session/consistency).



---

## 2. Architecture Definitions

* **Monorepo Structure (Bun Workspaces):**
  * `/apps/web`: Astro project (SSR adapter).
  * `/apps/api`: Cloudflare Worker (Hono + Durable Objects).
  * `/packages/shared`: Shared TypeScript types (DTOs, Zod schemas).
  * `/.github/workflows`: CI/CD definitions.



---

## 3. Implementation Milestones

### Milestone 1: Infrastructure & CI/CD Pipeline

**Goal:** A working monorepo where code pushed to `main` is automatically tested and deployed to a Cloudflare Preview environment.

* **Task 1.1:** Initialize Monorepo.
  * Create root `package.json` with Bun workspaces.
  * Initialize `apps/web` (Astro) and `apps/api` (Worker).
  * Initialize `packages/shared`.
  * **Constraint:** Configure `dependencies` in apps to use `"@nexus/shared": "workspace:*"`.


* **Task 1.2:** Configure GitHub Actions (`.github/workflows/ci.yml`).
  * *Job 1: Test:* Install Bun -> Run `bun test` -> Run `bun run lint` (Biome).
  * *Job 2: Deploy Preview:* **Sequential Deployment**. Deploy API first, capture URL, then build/deploy Web (see Tech Reference).
  * *Action:* Push config. Verify using `gh run watch`.


* **Task 1.3:** Cloudflare Resources (`wrangler.toml`).
  * Define D1 `nexus-db`, KV `nexus-cache`, DO `UserDO`.
  * *Action:* Commit `wrangler.toml`. Verify CI pipeline passes.


* **Task 1.4:** Database Migrations.
  * Create SQL migration for `oidc_clients`, `groups`, `audit_logs`.
  * *CI Step:* Update workflow to run `wrangler d1 migrations apply` on deployment.



### Milestone 2: Backend Core (Domain Logic)

**Goal:** Functional User entities and Cryptography services, verified via CI tests.

* **Task 2.1:** Cryptography Service (TDD).
  * *Test:* Create unit tests for JWT signing/verification.
  * *Impl:* Implement `KeyService` using `jose` library.
  * *Verify:* Push -> `gh run watch` -> Ensure `Test` job passes.


* **Task 2.2:** User Durable Object (TDD).
  * *Test:* Mock DO environment (Miniflare), test `createUser` and storage logic.
  * *Impl:* Create `UserDO` class with SQLite logic.
  * *Verify:* Push -> `gh run watch`.


* **Task 2.3:** WebAuthn Service (TDD).
  * *Test:* Validate mock FIDO2 registration/auth payloads.
  * *Impl:* Implement `WebAuthnService` logic using `@passwordless-id/webauthn` (or similar).
  * *Verify:* Push -> `gh run watch`.



### Milestone 3: Authentication API (The "Engine")

**Goal:** API endpoints for Headless Registration/Login are deployed and accessible.

* **Task 3.1:** Hono Router & Middleware.
  * Setup `apps/api` entry point with Error Handling and CORS.


* **Task 3.2:** Registration Endpoints.
  * Implement `POST /auth/register/options` & `POST /auth/register/verify`.
  * *Standard:* Use Types from `@nexus/shared`.


* **Task 3.3:** Authentication Endpoints.
  * Implement `POST /auth/login/options` & `POST /auth/login/verify`.
  * *Logic:* On success, set **HttpOnly**, **Secure**, **SameSite=Strict** session cookie.


* **Task 3.4:** Deploy & Verify.
  * Push to `main`.
  * Use `gh run watch` to confirm deployment.
  * Use `curl` against the deployed Preview URL to verify health check.



### Milestone 4: OIDC Compliance (The "Protocol")

**Goal:** Full OIDC Provider compliance (Discovery, JWKS, Auth Flow).

* **Task 4.1:** Discovery & JWKS.
  * Implement `/.well-known/openid-configuration` (Cached in KV).
  * Implement `/.well-known/jwks.json` (Public Keys from KV).


* **Task 4.2:** Authorization Endpoint (`/authorize`).
  * *Logic:* Validate Client/Redirect URI. Check Session Cookie. Issue Auth Code (stored in DO).
  * *Redirect:* If no session, redirect to Astro Login URL.


* **Task 4.3:** Token Endpoint (`/token`).
  * *Logic:* Exchange Auth Code + PKCE Verifier for ID/Access Tokens.


* **Task 4.4:** UserInfo Endpoint.
  * *Logic:* Validate Token -> Return Claims.
  * *Verify:* Push -> `gh run watch`.



### Milestone 5: Astro Frontend (The "Face")

**Goal:** A deployed UI that interacts with live Backend API.

* **Task 5.1:** Astro Setup.
  * Configure `apps/web` with Tailwind and Nano Stores.
  * *Env:* Ensure `PUBLIC_API_URL` is consumed from `import.meta.env`.


* **Task 5.2:** Login Page (`/login`).
  * Implement Username Input -> WebAuthn JS -> Backend API.


* **Task 5.3:** Consent Page (`/consent`).
  * UI for "Allow/Deny" scopes.


* **Task 5.4:** Profile Dashboard.
  * View active sessions/keys.


* **Task 5.5:** Deploy Frontend.
  * Push -> `gh run watch`.
  * Verify `apps/web` deployment via GitHub Actions logs.



### Milestone 6: Security & Production Hardening

**Goal:** Production-ready release.

* **Task 6.1:** Security Headers.
  * Add CSRF, CSP, and Rate Limiting (KV) middleware to API.


* **Task 6.2:** Production CI Job.
  * Add `deploy-prod` job to GitHub Actions (triggers on tags/release).


* **Task 6.3:** End-to-End Smoke Test.
  * Create a script (or Playwright test in CI) to simulate full login flow against Preview environment.



---

## 4. Critical Integration Standards

**1. Dynamic Environment Linking (Chicken-Egg Solution)**

* **Challenge:** The Backend URL is unknown before the first deploy.
* **Constraint:** The CI pipeline must be **Sequential**.
* **Step 1:** Deploy `apps/api`.
* **Step 2:** Capture of `deployment-url` output from Wrangler Action.
* **Step 3:** Pass this URL to the `apps/web` build command as `PUBLIC_API_URL` (see Technical Reference).



**2. Secrets Management Strategy**

* **Constraint:** Never commit secrets to `wrangler.toml`.
* **Action:**
  * **Local:** Use `.dev.vars` for local development secrets (e.g., `JWT_SECRET`).
  * **CI/CD:** Store secrets in **GitHub Actions Secrets**.
  * **Deployment:** The `cloudflare/wrangler-action` must be configured to pass these secrets to the deployed Worker.



**3. Monorepo Linking (Bun Workspaces)**

* **Constraint:** Use to `packages/shared` folder strictly.
* In `apps/web/package.json` and `apps/api/package.json`, dependency must be defined as:
```json
"dependencies": {
  "@nexus/shared": "workspace:*"
}

```


* **Agent Instruction:** "Always define DTOs (Data Transfer Objects) and Zod schemas in `@nexus/shared` first, then import them in both apps."



**4. Code Quality Standard (Biome)**

* **Constraint:** Use **Biome** for linting and formatting.
* Add a `lint` script to the root `package.json`: `biome check .`
* **CI Step:** Add `bun run lint` to the `test` job in GitHub Actions.



---

## 5. Technical Reference & Configuration

### A. GitHub Secrets Checklist

Ensure following are defined in the repository settings:

| Name | Description | Required Permissions (Cloudflare) |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Auth Token | **Pages (Edit)**, **Workers Scripts (Edit)**, **D1 (Edit)**, **KV (Edit)**, **User (Read)**. |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID | N/A |
| `JWT_PRIVATE_KEY` | Signing Key | N/A (RSA Private Key PEM) |

### B. CI Workflow Snippet (`.github/workflows/ci.yml`)

*Use this sequential logic to solve of URL dependency problem:*

```yaml
name: CI/CD
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test
      - run: bun run lint

  deploy-preview:
    needs: test
    if: github.ref != 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@1
      - run: bun install

      # 1. Deploy API first to get URL
      - name: Deploy API
        id: deploy-api
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: apps/api
          secrets: |
            JWT_PRIVATE_KEY
        env:
            JWT_PRIVATE_KEY: ${{ secrets.JWT_PRIVATE_KEY }}

      # 2. Build & Deploy Frontend (Injecting API URL)
      - name: Build & Deploy Frontend
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: apps/web
          command: pages deploy dist --project-name=nexus-web
          preCommands: |
            export PUBLIC_API_URL="${{ steps.deploy-api.outputs.deployment-url }}"
            bun run build

```

### C. Verification Cheatsheet

* **Watch Pipeline:** `gh run watch`
* **View Last Run:** `gh run view`
* **List Runs:** `gh run list --limit 5`
* **View Logs:** `gh run view --log`
