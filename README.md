# Tec-Domain-Template

Template لبناء أي TEC Domain App على Pi Network.

## استخدام

\`\`\`bash
git clone https://github.com/Yasser1728/Tec-Domain-Template Tec-[DomainName]
cd Tec-[DomainName]
cp .env.example .env.local
npm install --legacy-peer-deps
npm run dev
\`\`\`

## الملفات اللي بتتغير لكل domain

| الملف | التغيير |
|-------|---------|
| `package.json` | `"name": "tec-[domain]"` |
| `src/app/layout.tsx` | title + description |
| `src/app/page.tsx` | login page |
| `src/app/app/` | domain pages |
| `src/app/api/bff/` | domain BFF routes |
| `.env.local` | domain secrets |

## الملفات الثابتة (لا تتغير)

- `src/lib/bff/createHandler.ts`
- `src/lib-client/pi/pi-auth.ts`
- `src/lib-client/hooks/usePiAuth.ts`
- `src/components/ErrorBoundary.tsx`
- `middleware.ts`
- `next.config.js`
- `Dockerfile`
