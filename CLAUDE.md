> ⚡ **SESSION START — أول حاجة:** اقرأ `knowledge-base/C-02___CURRENT_STATE_.md` من `yasira82/tec-knowledge-base` (branch: `claude/gifted-knuth-1yhom3`) — ده مصدر الحقيقة للوضع الحالي. لا تعتمد على الذاكرة أو الملخص.

---

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
- Do NOT modify payment flow files without thorough testing

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

## Risk Register

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R1 | Pi SDK update breaks checkout | P0 | PAL (Objective 0.0) — wrap `window.Pi.*` |
| R2 | ADR-007 guard removed | P1 | `isHubNavigation()` in every handler — DO NOT REMOVE |
| R3 | BFF leaks Railway URL | P1 | server-only `API_GATEWAY_URL` |
| R4 | Cart state lost on refresh | P3 | useCart persists to localStorage `tec_cart` |

---

## Release Gate Protocol

```bash
npm run type-check    # 0 errors
npm run lint          # 0 errors
npx vitest            # all pass
git status            # clean
```

ADR-007 check: if modifying any payment handler file, verify `isHubNavigation()` guard present.

---

## Knowledge Base Reference
→ `yasira82/tec-knowledge-base` (branch: `claude/gifted-knuth-1yhom3`)
→ **Current State: `knowledge-base/C-02___CURRENT_STATE_.md`** — اقرأه أول كل session
→ Master index: `knowledge-base/C-57___MASTER_CONTENTS_INDEX.md`
→ Payment ownership (ADR-007): `knowledge-base/C-76___ADR-007.md`

---

## Skills

Available via plugin — invoke automatically when the situation matches:

| Situation | Skill |
|-----------|-------|
| Writing new feature or fixing a bug → use TDD | `/tdd` |
| Bug, regression, or unexpected behavior | `/diagnose` |
| Writing or modifying tests | `/test-guard` |
| Writing or modifying BFF routes, payment handlers, or API contracts | `/clean-code-guard` |
| Updating docs, CLAUDE.md, or knowledge-base entries | `/docs-guard` |
| Planning a new feature or architectural decision | `/grill-with-docs` |
| Breaking down a roadmap item into GitHub Issues | `/to-issues` |
| Session is getting long or context is filling up | `/handoff` |
| Adding pre-commit hooks to this repo | `/setup-pre-commit` |
