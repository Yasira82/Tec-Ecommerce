# TEC Ecommerce — Claude Code Instructions

## What This App Is

Pi-native ecommerce marketplace within the TEC Federated Platform.
Product listings, merchant stores, shopping cart, and Pi payments.

**Current Phase: Phase 0 — Pre-Mainnet Hardening**
NEW-J shipped (cart + ADR-007 fixes). Phase 0 items: tests + Pi App ID documentation.

---

## Stack

- Next.js 15 App Router + TypeScript strict
- @yasser172/tec-ui (design system, TEC_COLORS)
- @yasser172/tec-auth (getStoredUser, getAccessToken, ssoRedirect)
- Vitest (unit) + Playwright (e2e)
- Deployment: Vercel

---

## Architecture Rules

### Two-SDK Boundary
```
Client Components  →  lib-client/*  (useCart, pi-auth helpers, browser state)
API Routes (BFF)   →  @yasser172/tec-sdk via /api/bff/* (server-side only)
```

### ADR-007 — Pi Foreign Session (CRITICAL — DO NOT REMOVE)

Every Pi payment handler must include this guard:
```typescript
const isHubNavigation = () =>
  document.referrer.toLowerCase().includes('hub.tecosystem.app')

if (isHubNavigation() || !(window as any).Pi || !piReady) {
  redirectToHubPayment(...)   // Mode 1: Hub modal redirect
  return
}
// Mode 2: Direct Pi Browser payment
```

**Files with ADR-007 guard — DO NOT remove or bypass:**
- `src/app/page.tsx` → `handleBuy`
- `src/app/product/[id]/page.tsx` → `handleBuy`
- `src/app/store/[id]/page.tsx` → `handleBuy`
- `src/components/shop/CartDrawer.tsx` → `handleCheckout`

### Auth Pattern
```typescript
const user  = getStoredUser()    // tec_user cookie
const token = getAccessToken()   // tec_access_token cookie
const isAuth = !!(user && token)
headers: { 'x-csrf-token': getCsrfToken() }  // tec_csrf cookie
```

---

## Kernel Spec (C-47) — Relevant Rules

### Fail Closed (P6)
- Missing session on checkout → deny, redirect to login
- Missing Pi SDK → Mode 1 (never attempt Mode 2 without verified SDK)
- Missing isHubNavigation() check → FORBIDDEN (P1 violation)

### Invariants for Ecommerce
```
1. Payment cannot complete without approval
2. Cart total = sum of (price × qty) for all items
3. Order not created until payment approved
4. Hub payment URL = /hub?pay=1&... ONLY (never /hub/pay)
```

### Forbidden
```
- Silent failure in payment flow
- Transitioning from terminal payment states
- Reading another user's orders without authorization
```

---

## Feature Map

| Route | Feature | Status |
|-------|---------|--------|
| `/shop` | Product listing + search | ✅ |
| `/product/[id]` | Product detail + Buy Now | ✅ |
| `/store/[id]` | Merchant store + Buy Now | ✅ |
| `/orders` | Order history | ✅ |
| Cart (CartDrawer) | Multi-item checkout | ✅ |
| ProductCard | Merchant store link (🏪) | ✅ |
| ShopHeader | Cart badge + floating FAB | ✅ |

---

## BFF Routes

```
GET  /api/bff/products         # Product listing + search
GET  /api/bff/store/[id]       # Merchant + products
GET  /api/bff/orders           # Order history
POST /api/bff/orders           # Create order (supports items[] or product_id)
POST /api/bff/payment/approve  # Pi payment approve callback
POST /api/bff/payment/complete # Pi payment complete callback
POST /api/bff/payment/resolve  # Incomplete payment resolver
```

---

## Development Commands

```bash
npm run dev         # Next.js dev server (http://localhost:3000)
npm run build       # Production build
npm run lint        # ESLint
npx vitest          # Unit tests
npx playwright test # E2E tests
```

---

## What NOT To Do

- Do NOT remove ADR-007 `isHubNavigation()` check from any payment handler
- Do NOT call `window.Pi` without first checking `piReady && !isHubNavigation()`
- Do NOT store auth tokens in localStorage — cookies only
- Do NOT add `NEXT_PUBLIC_*` env vars for internal Railway service URLs
- Do NOT modify payment flow files without thorough testing:
  - `src/lib/pi-payment.ts`
  - `src/app/api/bff/payment/*`

---

## Commit Convention

```
feat(shop):      new shop feature
feat(cart):      cart feature
fix(payment):    payment flow fix (highest risk — test carefully)
fix(adr-007):    hub navigation guard fix
fix(cart):       cart bug
style(shop):     UI polish
```

---

## Phase 0 Items (C-41 — Before Mainnet)

```
□ Write Vitest tests for BFF routes          ← NEXT priority
□ Write Vitest tests for useCart hook        ← NEXT priority
□ Document Pi App ID + domain (tec-ecommerce → tecosystem.app/shop)
□ Add to Architecture Binding map in tec-core-backend
□ Upgrade to shared @yasser172/tec-ui PaymentModal when v1.2.0 publishes
□ PI_SANDBOX=false verified in production environment
```

### Test Coverage Targets (Phase 0 gate)
| File | Priority | Scenarios |
|------|----------|-----------|
| `src/lib-client/cart/useCart.ts` | HIGH | addToCart, removeFromCart, updateQty, clearCart, localStorage persist |
| `src/app/api/bff/orders/route.ts` | HIGH | single product (product_id), multi-item (items[]), auth fail |
| `src/app/api/bff/payment/approve/route.ts` | MEDIUM | success, invalid payment_id, gateway error |
| `src/app/api/bff/payment/complete/route.ts` | MEDIUM | success, already completed (409), gateway error |

---

## Platform Orchestra — This Repo

**Role:** Consumer Marketplace — Layer 1 complete, reference implementation for payment patterns
**Upstream:** @yasser172/tec-auth · @yasser172/tec-ui · @yasser172/tec-sdk · tec-core-backend
**Downstream:** None — end-user-facing app

---

## Commercial Targets

- Payment success rate: ≥ 95% (24h dashboard target)
- Cart checkout: multi-item Pi payment via CartDrawer ✅ shipped
- Merchant discovery: every product links to merchant store page ✅ shipped
- Tests coverage ≥ 60% before Phase 1

---

## Risk Register

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R1 | Pi SDK update breaks checkout | P0 | PAL (Objective 0.0) — wrap `window.Pi.*` |
| R2 | ADR-007 guard removed | P1 | `isHubNavigation()` in every handler — DO NOT REMOVE |
| R3 | BFF leaks Railway URL | P1 | server-only `API_GATEWAY_URL` |
| R4 | Cart state lost on refresh | P3 | useCart persists to localStorage `tec_cart` |

---

## Platform Governance

### SHARED
- Payment callbacks: POST `/api/bff/payment/approve|complete` — do not modify signatures
- Auth: Hub SSO cookies (`tec_access_token`, `tec_csrf`, `tec_user`)
- Order contract: `items: [{ productId, qty }]` format

### SOVEREIGN
- Shop UI/UX, product listing layout
- Cart drawer design and UX
- Store page layout and merchant attribution

---

## Release Gate Protocol

```bash
npm run type-check    # 0 errors
npm run lint          # 0 errors
npx vitest            # all pass
git status            # clean
git fetch origin claude/ecommerce-engineering-review-EuiQO
git rebase origin/claude/ecommerce-engineering-review-EuiQO
```

ADR-007 check: if modifying any payment handler file, verify `isHubNavigation()` guard present.

---

## Platform Context

Full platform context, ADR system, and engineering roadmap:
→ `TEC_MODELS_PAT.prompt.yml` in yasira82/tec-app (branch: claude/ecommerce-engineering-review-EuiQO)
→ `TEC_Ecosystem_AI_Key.prompt.yml` in yasira82/tec-app
→ C-47 Kernel Spec — P6 Fail Closed, Payment Invariants
→ C-41 Engineering Roadmap — Phase 0 ecommerce items

---

## Dynamic Orchestration

### Ecosystem Role
**Consumer Marketplace** — Pi-native ecommerce. Follows patterns from tec-commerce (reference implementation). ADR-007 guard exists in 4 payment handler files — any payment change requires checking all 4.

### Dependency Map

| Direction | Repos / Services |
|-----------|------------------|
| Upstream | `@yasser172/tec-auth` · `@yasser172/tec-ui` · `@yasser172/tec-sdk` · `tec-core-backend` |
| Downstream | None — end-user-facing app |

### Cross-Repo Workflow Triggers

| Event | Coordinate With | Required Action |
|-------|----------------|------------------|
| Payment/checkout change | tec-commerce (reference impl) | Check commerce pattern first — then align |
| `isHubNavigation()` behavior change | tec-app (Hub) | ADR-007 = shared contract — 4 files in this repo must stay aligned |
| `@yasser172/tec-ui` version bump | tec-app, tec-assets, tec-commerce | Coordinate simultaneous deploy with all 4 apps |
| New auth behavior | tec-auth (npm package) | Platform-wide — test all 4 apps |
| Hub payment URL change | tec-app (Hub) | `/hub?pay=1` LOCKED — ADR-007 format must not change |
| CartDrawer / cart hook change | None (sovereign) | Local concern — but test Mode 1 + Mode 2 |

### ADR-007 Files (4 guards — DO NOT REMOVE from any):
```
src/app/page.tsx                     → handleBuy
src/app/product/[id]/page.tsx        → handleBuy
src/app/store/[id]/page.tsx          → handleBuy
src/components/shop/CartDrawer.tsx   → handleCheckout
```

### Release Chain Position

```
tec-core-backend (deploy)
  → tec-sdk (npm publish)
    → tec-auth (npm publish)
      → tec-ui (npm publish)
        → tec-app + tec-ecommerce + tec-assets + tec-commerce  ← HERE (simultaneous)
```

### Knowledge Base Reference
→ `yasira82/tec-knowledge-base` (branch: `claude/gifted-knuth-1yhom3`)
→ Master index: `knowledge-base/C-57___MASTER_CONTENTS_INDEX.md`
→ Payment ownership (ADR-007): `knowledge-base/C-76___ADR-007.md`
→ Frontend state governance: `knowledge-base/C-72___FRONTEND_STATE_GOVERNANCE.md`
→ Strategic roadmap: `knowledge-base/C-77___STRATEGIC_ANALYSIS___RISK_ASSESSMENT.md`
