import { createAuthMiddleware } from '@yasser172/tec-auth/middleware';

export default createAuthMiddleware({
  protectedRoutes:    ['/dashboard', '/profile', '/settings'],
  csrfProtectedPaths: ['/api/auth/logout', '/api/auth/refresh', '/api/bff/'],
  loginRedirectUrl:   '/',
});

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/profile/:path*',
    '/settings/:path*',
    '/api/auth/logout',
    '/api/auth/refresh',
    '/api/bff/:path*',
  ],
};
