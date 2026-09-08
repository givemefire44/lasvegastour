import { Metadata } from 'next'
import { client } from '@/sanity/lib/client'
import { urlFor } from '@/sanity/lib/image'
import Container from '@/app/components/Container'
import Footer from '@/app/components/Footer'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import AuthorBox from '@/app/components/AuthorBox'

const SITE_URL = 'https://lasvegastour.com'
const PAGE_URL = `${SITE_URL}/las-vegas-guides`

// Páginas utilitarias que no forman parte de la biblioteca
const EXCLUDED_SLUGS = [
  'about-us',
  'contact-us',
  'terms-and-conditions',
  'cookies-and-privacy-policy',
]

interface GuideItem {
  _id: string
  title: string
  slug: string
  seoDescription?: string
  isPillar?: boolean
  parentPillarId?: string
  categoryTitle?: string
}

async function getAllGuides(): Promise<GuideItem[]> {
  const query = `*[
    _type == "page"
    && !(_id in path("drafts.**"))
    && defined(slug.current)
    && !(slug.current in [${EXCLUDED_SLUGS.map((s) => `"${s}"`).join(', ')}])
  ]{
    _id,
    title,
    "slug": slug.current,
    seoDescription,
    isPillar,
    "parentPillarId": parentPillar._ref,
    "categoryTitle": category->title
  } | order(title asc)`
  return await client.fetch(query, {}, { next: { revalidate: 3600 } })
}

// Reutiliza la imagen social de la homepage (Sanity) para las cards al compartir
async function getSocialImage(): Promise<string | null> {
  const img = await client.fetch(
    `*[_type == "homepage"][0].seo.socialImage`,
    {},
    { next: { revalidate: 86400 } }
  )
  return img?.asset
    ? urlFor(img).width(1200).height(630).format('webp').quality(90).url()
    : null
}

function anchorId(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-')
}

function truncate(text: string | undefined, max = 160): string {
  if (!text) return ''
  if (text.length <= max) return text
  return text.slice(0, max).replace(/\s+\S*$/, '') + '…'
}

export async function generateMetadata(): Promise<Metadata> {
  const [guides, socialImage] = await Promise.all([getAllGuides(), getSocialImage()])
  const count = guides.filter((g) => g.slug !== 'methodology').length
  const ogTitle = `Las Vegas Guides Library: All ${count} Articles`
  return {
    title: `Las Vegas Guides Library: All ${count} Articles | LasVegasTour`,
    description: `Every guide we've published about Las Vegas — shows, helicopter tours, day trips, the Strip, costs and logistics. ${count} in-depth articles, growing every week.`,
    alternates: { canonical: PAGE_URL },
    openGraph: {
      type: 'website',
      url: PAGE_URL,
      title: ogTitle,
      description: `Every guide we've published about Las Vegas, in one place. ${count} in-depth articles.`,
      siteName: 'LasVegasTour',
      ...(socialImage && {
        images: [{ url: socialImage, width: 1200, height: 630, alt: ogTitle, type: 'image/webp' }],
      }),
    },
    ...(socialImage && {
      twitter: { card: 'summary_large_image', title: ogTitle, images: [socialImage] },
    }),
    robots: { index: true, follow: true },
  }
}

export default async function LasVegasGuidesPage() {
  const all = await getAllGuides()

  const methodology = all.find((g) => g.slug === 'methodology')
  const guides = all.filter((g) => g.slug !== 'methodology')

  // Sección research: pilares con sus supportings anidados
  const pillars = guides
    .filter((g) => g.isPillar)
    .sort((a, b) => a.title.localeCompare(b.title))
  const supportingsByPillar = new Map<string, GuideItem[]>()
  for (const g of guides) {
    if (g.parentPillarId) {
      const list = supportingsByPillar.get(g.parentPillarId) || []
      list.push(g)
      supportingsByPillar.set(g.parentPillarId, list)
    }
  }

  // Resto: agrupado por su categoría de Sanity (crece solo al publicar)
  const rest = guides.filter((g) => !g.isPillar && !g.parentPillarId)
  const sections = new Map<string, GuideItem[]>()
  for (const g of rest) {
    const key = (g.categoryTitle || 'More Las Vegas Guides').trim().replace(/\s{2,}/g, ' ')
    const list = sections.get(key) || []
    list.push(g)
    sections.set(key, list)
  }
  const orderedSections = [...sections.entries()].sort((a, b) => b[1].length - a[1].length)

  // Lista plana para el schema ItemList (todos los artículos, en orden de página)
  const flatOrder: GuideItem[] = [
    ...pillars.flatMap((p) => [p, ...(supportingsByPillar.get(p._id) || [])]),
    ...orderedSections.flatMap(([, items]) => items),
  ]

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${PAGE_URL}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Las Vegas Guides Library', item: PAGE_URL },
    ],
  }

  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${PAGE_URL}#collection`,
    name: 'Las Vegas Guides Library',
    description: `Every guide published on LasVegasTour: shows, helicopter tours, Grand Canyon and Hoover Dam day trips, the Strip, costs and logistics. ${guides.length} in-depth articles.`,
    url: PAGE_URL,
    isPartOf: {
      '@type': 'WebSite',
      '@id': `${SITE_URL}#website`,
      name: 'LasVegasTour',
      url: SITE_URL,
    },
    about: {
      '@type': 'City',
      '@id': `${SITE_URL}#las-vegas`,
      name: 'Las Vegas',
      sameAs: 'https://en.wikipedia.org/wiki/Las_Vegas',
    },
    breadcrumb: { '@id': `${PAGE_URL}#breadcrumb` },
    mainEntity: {
      '@type': 'ItemList',
      '@id': `${PAGE_URL}#list`,
      numberOfItems: flatOrder.length,
      itemListElement: flatOrder.map((g, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE_URL}/${g.slug}`,
        name: g.title,
      })),
    },
  }

  const sectionHeadingStyle = {
    fontSize: '1.875rem',
    fontWeight: 700,
    color: '#1a1a1a',
    marginBottom: '0.5rem',
  } as const

  const itemRow = (g: GuideItem) => (
    <li key={g._id} style={{ padding: '0.875rem 0', borderBottom: '1px solid #f3f4f6' }}>
      <a
        href={`/${g.slug}`}
        style={{ color: '#1f2937', fontWeight: 600, fontSize: '1.05rem', textDecoration: 'none', lineHeight: 1.4 }}
      >
        {g.title}
      </a>
      {g.seoDescription && (
        <p style={{ margin: '0.25rem 0 0 0', color: '#6b7280', fontSize: '0.92rem', lineHeight: 1.5 }}>
          {truncate(g.seoDescription)}
        </p>
      )}
    </li>
  )

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />

      <Container>
        <Breadcrumbs noSchema items={[
          { label: 'Home', href: '/' },
          { label: 'Las Vegas Guides Library', href: '/las-vegas-guides', isActive: true },
        ]} />

        {/* HERO */}
        <section style={{ padding: '2rem 0 1.5rem 0' }}>
          <h1 style={{
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            fontWeight: 'bold',
            marginBottom: '1rem',
            color: '#1a1a1a',
            lineHeight: 1.1,
          }}>
            Las Vegas Guides Library
          </h1>
          <p style={{
            fontSize: 'clamp(1.1rem, 2.5vw, 1.4rem)',
            color: '#4b5563',
            lineHeight: 1.5,
            maxWidth: '760px',
            marginBottom: '1.5rem',
          }}>
            Every guide we&apos;ve published about Las Vegas — all {guides.length} of
            them, in one place: shows, helicopter tours, Grand Canyon and Hoover Dam day trips,
            getting around, costs and what things really run you. This library grows every week.
          </p>
          <AuthorBox author="curator-team" variant="byline" />
        </section>

        {/* SALTOS DE SECCIÓN */}
        <nav aria-label="Sections" style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          margin: '0 0 1rem 0',
        }}>
          {[
            { label: `The Research Program (${pillars.length + [...supportingsByPillar.values()].flat().length})`, id: 'the-research-program' },
            ...orderedSections.map(([t, items]) => ({ label: `${t} (${items.length})`, id: anchorId(t) })),
          ].map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              style={{
                padding: '0.4rem 0.9rem',
                background: '#f3f4f6',
                border: '1px solid #e5e7eb',
                borderRadius: '999px',
                color: '#374151',
                fontSize: '0.88rem',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              {s.label}
            </a>
          ))}
        </nav>

        {/* RESEARCH PROGRAM */}
        <section id="the-research-program" style={{ margin: '3rem 0', scrollMarginTop: '90px' }}>
          <h2 style={sectionHeadingStyle}>The Research Program</h2>
          <p style={{ fontSize: '1rem', color: '#6b7280', marginBottom: '1rem', maxWidth: '760px' }}>
            Articles built on rated reviews we collected and measured ourselves, not on what
            the booking platforms show first.{' '}
            <a href="/las-vegas-research" style={{ color: '#2563eb', textDecoration: 'none' }}>
              About the program
            </a>
            {methodology && (
              <>
                {' · '}
                <a href={`/${methodology.slug}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                  Methodology
                </a>
              </>
            )}
          </p>
          {pillars.map((pillar) => (
            <div key={pillar._id} style={{ margin: '1.75rem 0' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '0.25rem' }}>
                <a href={`/${pillar.slug}`} style={{ color: '#1a1a1a', textDecoration: 'none' }}>
                  {pillar.title}
                </a>
              </h3>
              {pillar.seoDescription && (
                <p style={{ margin: '0 0 0.5rem 0', color: '#6b7280', fontSize: '0.92rem', lineHeight: 1.5 }}>
                  {truncate(pillar.seoDescription)}
                </p>
              )}
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, borderTop: '1px solid #f3f4f6' }}>
                {(supportingsByPillar.get(pillar._id) || []).map(itemRow)}
              </ul>
            </div>
          ))}
        </section>

        {/* RESTO DE SECCIONES, POR CATEGORÍA */}
        {orderedSections.map(([sectionTitle, items]) => (
          <section key={sectionTitle} id={anchorId(sectionTitle)} style={{ margin: '3rem 0', scrollMarginTop: '90px' }}>
            <h2 style={sectionHeadingStyle}>{sectionTitle}</h2>
            <p style={{ fontSize: '0.95rem', color: '#6b7280', marginBottom: '0.5rem' }}>
              {items.length} {items.length === 1 ? 'article' : 'articles'}
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, borderTop: '1px solid #f3f4f6' }}>
              {items.map(itemRow)}
            </ul>
          </section>
        ))}

        {/* AUTHOR BOX FULL */}
        <section style={{ margin: '3rem 0' }}>
          <AuthorBox author="curator-team" variant="full" />
        </section>
      </Container>

      <Footer />
    </div>
  )
}
