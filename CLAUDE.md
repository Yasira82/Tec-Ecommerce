# TEC Ecommerce — Claude Code Instructions

## What This App Is

Pi-native ecommerce marketplace within the TEC Federated Platform.
Product listings, merchant stores, shopping cart, and Pi payments.

**Current Phase: Platform Hardening** — NEW-J (cart + ADR-007 fixes) shipped.
Next: support observability and auth test readiness.

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

**Files with ADR-007 guard in place — DO NOT remove or bypass:**
- `src/app/page.tsx` → `handleBuy`
- `src/app/product/[id]/page.tsx` → `handleBuy`
- `src/app/store/[id]/page.tsx` → `handleBuy`
- `src/components/shop/CartDrawer.tsx` → `handleCheckout`

### Auth Pattern
```typescript
// Read auth state on client:
const user  = getStoredUser()    // tec_user cookie
const token = getAccessToken()   // tec_access_token cookie
const isAuth = !!(user && token)

// CSRF on all POST BFF routes:
headers: { 'x-csrf-token': getCsrfToken() }  // tec_csrf cookie
```

---

## Feature Map

| Route | Feature | Status |
|-------|---------|--------|
| `/shop` | Product listing + search | ✅ |
| `/product/[id]` | Product detail + Buy Now | ✅ |
| `/store/[id]` | Merchant store + cart | ✅ |
| `/orders` | Order history | ✅ |
| Cart (CartDrawer) | Multi-item checkout | ✅ |

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

- Do NOT remove the ADR-007 `isHubNavigation()` check from any payment handler
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

## Platform Context

Full platform context, ADR system, and engineering roadmap:
→ `TEC_MODELS_PAT.prompt.yml` in yasira82/tec-app (branch: claude/ecommerce-engineering-review-EuiQO)
→ `TEC_Ecosystem_AI_Key.prompt.yml` in yasira82/tec-app
