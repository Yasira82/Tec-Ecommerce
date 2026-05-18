import { createAuthMiddleware } from '@yasser172/tec-auth/middleware';

// ── تعديل حسب الـ domain ──────────────────────────────────
export default createAuthMiddleware({
  protectedRoutes:    ['/app', '/dashboard', '/profile', '/settings'],
  csrfProtectedPaths: ['/api/auth/logout', '/api/auth/refresh', '/api/bff/'],
  loginRedirectUrl:   '/',
});

export const config = {
  matcher: [
    '/app/:path*',
    '/dashboard/:path*',
    '/profile/:path*',
    '/settings/:path*',
    '/api/auth/logout',
    '/api/auth/refresh',
    '/api/bff/:path*',
  ],
};
