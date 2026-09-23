/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ OPTIMIZACIÓN - Compresión automática
  compress: true,

  // 🚀 OPTIMIZACIONES
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // ✅ DESHABILITAR ESLINT EN BUILD
  eslint: {
    ignoreDuringBuilds: true,
  },

  // ✅ Imágenes optimizadas
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.sanity.io' },
      { protocol: 'https', hostname: 'viator.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
  },

  // ✅ Headers de seguridad/perf
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },

  // Slugs institucionales que nunca existieron con ese nombre (medido 23 sep 2026).
  // Los componentes ya apuntan al slug real; esto cubre los enlaces entrantes de afuera.
  async redirects() {
    return [
      {
        source: '/privacy-policy',
        destination: '/cookies-and-privacy-policy',
        permanent: true,
      },
      {
        source: '/terms',
        destination: '/terms-and-conditions',
        permanent: true,
      },
      {
        source: '/contact',
        destination: '/contact-us',
        permanent: true,
      },
    ];
  },

};

module.exports = nextConfig;
