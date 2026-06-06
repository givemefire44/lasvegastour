import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/studio/', '/_next/static/'],
      },
    ],
    sitemap: 'https://lasvegastour.com/sitemap.xml',
  }
}