import { createAuthMiddleware } from '@yasser172/tec-auth/middleware';

export default createAuthMiddleware({
  protectedRoutes: ['/orders', '/checkout', '/profile'],
  csrfExcluded:    ['/api/bff/payment/'],
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
