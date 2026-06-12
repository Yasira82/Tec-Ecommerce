const path = require('path');

// ✅ PI_SANDBOX build-time guard — Mainnet checklist
// Blocks the production build if sandbox mode is active.
// Set NEXT_PUBLIC_PI_SANDBOX=false on Vercel before Mainnet deploy.
if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_PI_SANDBOX !== 'false') {
  throw new Error(
    'FATAL: NEXT_PUBLIC_PI_SANDBOX must be set to "false" for production builds. ' +
    'Current value: "' + (process.env.NEXT_PUBLIC_PI_SANDBOX ?? 'undefined') + '". ' +
    'Set NEXT_PUBLIC_PI_SANDBOX=false on Vercel before deploying to Mainnet.'
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint:  { ignoreDuringBuilds: false },
  output:  'standalone',

  images: {
    formats:         ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
    remotePatterns: [
      { protocol: 'https', hostname: '**.vercel.app'  },
      { protocol: 'https', hostname: '**.railway.app' },
      { protocol: 'https', hostname: 'api.minepi.com' },
    ],
  },

  compress: true,

  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, 'src'),
    };
    return config;
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff'                         },
          { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control',  value: 'on'                              },
          { key: 'Permissions-Policy',      value: 'camera=(), microphone=()'        },
          {
            key:   'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' sdk.minepi.com *.minepi.com",
              "connect-src 'self' https: wss:",
              "img-src 'self' data: blob: https:",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' data:",
              "frame-src 'self' sdk.minepi.com *.minepi.com",
              "worker-src 'self' blob:",
              "frame-ancestors 'self' *.minepi.com minepi.com",
            ].join('; '),
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
      },
    ];
  },
};

module.exports = nextConfig;
