import { createAuthMiddleware } from '@yasser172/tec-auth/middleware';

export default createAuthMiddleware({
  protectedRoutes:    ['/shop', '/app', '/dashboard', '/profile', '/settings'],
  csrfProtectedPaths: ['/api/auth/logout', '/api/auth/refresh', '/api/bff/'],
  loginRedirectUrl:   '/',
});

export const config = {
  matcher: [
    '/shop/:path*',
    '/app/:path*',
    '/dashboard/:path*',
    '/profile/:path*',
    '/settings/:path*',
    '/api/auth/logout',
    '/api/auth/refresh',
    '/api/bff/:path*',
  ],
};
