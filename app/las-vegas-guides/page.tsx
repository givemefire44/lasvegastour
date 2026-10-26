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
  heroImage?: any
}

// GRUPOS POR VERTICAL (26 oct 2026). Antes: research aparte y el resto en un solo grupo de 23 por su categoria de
// Sanity, que es la misma para todos. Plan medido en tour-importer/articles/enlazado/grupos-guides-dryrun.mjs del
// pipeline: cada page va al primer patron que calza con slug + titulo (el orden importa: helicoptero antes que Gran
// Canon); un soporte va siempre con el grupo de su pilar, para no partir la familia del research.
const GROUP_RULES: [string, RegExp][] = [
  ['Helicopter Tours', /helicopter|heli-/],
  ['Grand Canyon, Antelope and the Skywalk', /grand-canyon|antelope|skywalk|horseshoe|eagle-point|west-rim|south-rim|airplane/],
  ['Shows and Entertainment', /show|cirque|sphere|absinthe|blue-man|mystere|\bka\b|-o-|michael-jackson|shin-lim|tournament-of-kings|magic|comedy/],
  ['Day Trips: Hoover Dam, Red Rock, Zion and More', /hoover|lake-mead|zion|bryce|death-valley|valley-of-fire|red-rock|national-park|seven-magic|day-trip/],
  ['Adventure: ATV, Driving, Shooting', /atv|supercar|shooting|horseback|zip-line|desert-adventure|scooter|slingshot/],
  ['The Strip, Downtown, Food and Weddings', /strip|fremont|nightlife|club|food|high-roller|neon|casino|gambling|cartzilla/],
  ['Planning, Costs and Getting Around', /first-time|cost|fees|tipping|mistakes|get-around|pickup|group-size|kids|weather|planning|how-to/],
]
// Slugs que el patron manda a otro lado por una palabra suelta del titulo (medido en el dry-run)
const GROUP_FIXED: Record<string, string> = {
  'how-much-las-vegas-trip-costs': 'Planning, Costs and Getting Around',
  'how-to-get-around-las-vegas': 'Planning, Costs and Getting Around',
  'las-vegas-atv-tours-nellis-dunes-valley-of-fire': 'Adventure: ATV, Driving, Shooting',
}
// Orden en la pagina
const GROUP_ORDER = [
  'Grand Canyon, Antelope and the Skywalk',
  'Helicopter Tours',
  'Shows and Entertainment',
  'Day Trips: Hoover Dam, Red Rock, Zion and More',
  'Adventure: ATV, Driving, Shooting',
  'The Strip, Downtown, Food and Weddings',
  'Planning, Costs and Getting Around',
  'More Las Vegas Guides',
]

function groupOf(g: GuideItem): string {
  if (GROUP_FIXED[g.slug]) return GROUP_FIXED[g.slug]
  const k = `${g.slug} ${g.title}`.toLowerCase()
  const hit = GROUP_RULES.find(([, re]) => re.test(k))
  return hit ? hit[0] : 'More Las Vegas Guides'
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
    "categoryTitle": category->title,
    heroImage
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

  // Grupos por vertical: un soporte va con el grupo de su pilar
  const byId = new Map(guides.map((g) => [g._id, g]))
  const sections = new Map<string, GuideItem[]>()
  for (const g of guides) {
    const parent = g.parentPillarId ? byId.get(g.parentPillarId) : undefined
    const key = groupOf(parent || g)
    const list = sections.get(key) || []
    list.push(g)
    sections.set(key, list)
  }
  // Dentro de cada grupo: pilar, sus soportes, despues el resto (cluster); cada tramo por titulo
  const layer = (g: GuideItem) => (g.isPillar ? 0 : g.parentPillarId ? 1 : 2)
  const orderedSections = GROUP_ORDER
    .filter((t) => sections.has(t))
    .map((t) => [t, (sections.get(t) || []).sort((a, b) => layer(a) - layer(b) || a.title.localeCompare(b.title))] as [string, GuideItem[]])

  // Lista plana para el schema ItemList (todos los artículos, en orden de página)
  const flatOrder: GuideItem[] = orderedSections.flatMap(([, items]) => items)

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

  const card = (g: GuideItem) => (
    <a key={g._id} href={`/${g.slug}`} className="guides-card">
      <div className="guides-card-img">
        {g.heroImage?.asset ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={urlFor(g.heroImage).width(600).height(360).fit('crop').format('webp').quality(75).url()}
            alt={g.heroImage.alt || g.title}
            loading="lazy"
            width={600}
            height={360}
          />
        ) : null}
        {g.isPillar && <span className="guides-card-tag">Overview</span>}
      </div>
      <div className="guides-card-body">
        <h3>{g.title}</h3>
        {g.seoDescription && <p>{truncate(g.seoDescription, 130)}</p>}
      </div>
    </a>
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
          {orderedSections.map(([t, items]) => ({ label: `${t} (${items.length})`, id: anchorId(t) })).map((s) => (
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

        {/* EL RESEARCH, EN UNA LINEA: sus pilares ahora encabezan cada grupo */}
        <p style={{ fontSize: '0.95rem', color: '#6b7280', margin: '0 0 1rem 0', maxWidth: '760px' }}>
          Articles marked Overview open a research series built on rated reviews we collected and measured
          ourselves.{' '}
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

        <style>{`
          .guides-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.25rem; }
          @media (max-width: 1024px) { .guides-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
          @media (max-width: 640px) { .guides-grid { grid-template-columns: minmax(0, 1fr); } }
          .guides-card { display: flex; flex-direction: column; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; text-decoration: none; color: #1f2937; box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: box-shadow .15s ease, transform .15s ease; }
          .guides-card:hover { box-shadow: 0 6px 18px rgba(0,0,0,0.08); transform: translateY(-2px); }
          .guides-card-img { position: relative; aspect-ratio: 5 / 3; background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); }
          .guides-card-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
          .guides-card-tag { position: absolute; top: 10px; left: 10px; background: #1f2937; color: #fff; font-size: 0.72rem; font-weight: 600; letter-spacing: .03em; text-transform: uppercase; padding: 3px 8px; border-radius: 6px; }
          .guides-card-body { padding: 0.9rem 1rem 1.1rem; }
          .guides-card-body h3 { font-size: 1.02rem; font-weight: 650; line-height: 1.35; margin: 0 0 0.4rem; color: #1a1a1a; }
          .guides-card-body p { font-size: 0.88rem; line-height: 1.5; color: #6b7280; margin: 0; }
        `}</style>

        {/* SECCIONES POR VERTICAL */}
        {orderedSections.map(([sectionTitle, items]) => (
          <section key={sectionTitle} id={anchorId(sectionTitle)} style={{ margin: '3rem 0', scrollMarginTop: '90px' }}>
            <h2 style={sectionHeadingStyle}>{sectionTitle}</h2>
            <p style={{ fontSize: '0.95rem', color: '#6b7280', marginBottom: '1rem' }}>
              {items.length} {items.length === 1 ? 'article' : 'articles'}
            </p>
            <div className="guides-grid">
              {items.map(card)}
            </div>
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
