import { Metadata } from 'next'
import Image from 'next/image'
import { client } from '@/sanity/lib/client'
import { urlFor } from '@/sanity/lib/image'
import Container from '@/app/components/Container'
import Footer from '@/app/components/Footer'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import AuthorBox from '@/app/components/AuthorBox'

const SITE_URL = 'https://lasvegastour.com'
const PAGE_URL = `${SITE_URL}/colosseum-research`
const DATASET_ID = `${PAGE_URL}#dataset`
const COLLECTION_ID = `${PAGE_URL}#collection`
const INTERCOPER_ID = 'https://intercoper.com/#organization'

export const metadata: Metadata = {
  title: 'The Colosseum Research Program | LasVegasTour',
  description: 'Original research on the world\'s most reviewed monument tours. 8,100 items analyzed across 5 sources. 51 articles published. Refreshed every 72 hours.',
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: 'website',
    url: PAGE_URL,
    title: 'The Colosseum Research Program',
    description: 'Original research on the world\'s most reviewed monument tours.',
    siteName: 'LasVegasTour',
  },
  robots: { index: true, follow: true },
}

interface Pillar {
  _id: string
  title: string
  slug: { current: string }
  seoDescription?: string
  heroImage?: {
    asset?: { _id?: string; url?: string }
    alt?: string
  }
}

async function getPillars(): Promise<Pillar[]> {
  const query = `*[_type == "page" && isPillar == true] | order(title asc) {
    _id,
    title,
    slug,
    seoDescription,
    heroImage{
      asset->{ _id, url },
      alt
    }
  }`
  return await client.fetch(query, {}, { next: { revalidate: 3600 } })
}

export default async function ColosseumResearchPage() {
  const pillars = await getPillars()

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${PAGE_URL}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Colosseum Research', item: PAGE_URL },
    ],
  }

  const datasetSchema = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    '@id': DATASET_ID,
    name: 'Colosseum Tour Research Corpus 2026',
    alternateName: 'Colosseum Research Corpus',
    description: 'Curated corpus of 8,100 items related to Colosseum tours, gathered from five independent sources (YouTube, TripAdvisor, Google Maps, GetYourGuide, Trustpilot). Includes verified visitor reviews, video transcripts, public Q&A and operator data. Used as the primary evidence base for the Colosseum Research Program articles.',
    url: PAGE_URL,
    sameAs: PAGE_URL,
    creator: {
      '@type': 'Organization',
      '@id': INTERCOPER_ID,
      name: 'Intercoper',
      url: 'https://intercoper.com',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Colosseum Roman',
      url: SITE_URL,
    },
    datePublished: '2026-01-15',
    dateModified: new Date().toISOString().split('T')[0],
    inLanguage: 'en',
    isAccessibleForFree: true,
    license: 'https://creativecommons.org/licenses/by/4.0/',
    keywords: [
      'Colosseum',
      'Rome tours',
      'tourism research',
      'monument tours',
      'visitor reviews',
      'tour quality',
    ],
    spatialCoverage: {
      '@type': 'Place',
      name: 'Colosseum, Rome, Italy',
    },
    temporalCoverage: '2020-01-01/2026-05-12',
    variableMeasured: [
      'Tour rating (1-5)',
      'Tour price (USD/EUR)',
      'Tour duration (minutes)',
      'Review sentiment',
      'Reviewer nationality',
      'Guide mentions',
      'Operator name',
    ],
    distribution: {
      '@type': 'DataDownload',
      encodingFormat: 'text/html',
      contentUrl: PAGE_URL,
    },
  }

  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': COLLECTION_ID,
    name: 'The Colosseum Research Program',
    description: 'Original research on the world\'s most reviewed monument tours. Nine evidence-based pillars covering tickets, tiers, premium access, combos, guides, operators, logistics, timing, and comfort.',
    url: PAGE_URL,
    isPartOf: {
      '@type': 'WebSite',
      '@id': `${SITE_URL}#website`,
      name: 'LasVegasTour',
      url: SITE_URL,
    },
    about: {
      '@type': 'TouristAttraction',
      '@id': `${SITE_URL}#colosseum`,
      name: 'Colosseum',
      sameAs: 'https://en.wikipedia.org/wiki/Colosseum',
    },
    publisher: {
      '@type': 'Organization',
      '@id': INTERCOPER_ID,
      name: 'Intercoper',
      url: 'https://intercoper.com',
    },
    breadcrumb: { '@id': `${PAGE_URL}#breadcrumb` },
    isBasedOn: { '@id': DATASET_ID },
    hasPart: pillars.map((p) => ({
      '@type': 'Article',
      '@id': `${SITE_URL}/${p.slug.current}#article`,
      url: `${SITE_URL}/${p.slug.current}`,
      name: p.title,
    })),
  }

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />

      <Container>
        <Breadcrumbs items={[
          { label: 'Home', href: '/' },
          { label: 'Colosseum Research', href: '/colosseum-research', isActive: true },
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
            The Colosseum Research Program
          </h1>
          <p style={{
            fontSize: 'clamp(1.1rem, 2.5vw, 1.4rem)',
            color: '#4b5563',
            lineHeight: 1.5,
            maxWidth: '760px',
            marginBottom: '1.5rem',
          }}>
            Original research on the world&apos;s most reviewed monument tours.
          </p>
          <AuthorBox author="curator-team" variant="byline" />
        </section>

        {/* BY THE NUMBERS */}
        <section style={{
          margin: '2rem 0',
          padding: '2rem',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
        }}>
          <h2 style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: '#6b7280',
            marginBottom: '1.5rem',
          }}>
            By the Numbers
          </h2>
          <div className="research-numbers-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1.5rem',
          }}>
            {[
              { value: '8,100', label: 'Items analyzed' },
              { value: '5', label: 'Independent sources' },
              { value: '51', label: 'Articles published' },
              { value: '72h', label: 'Refresh cadence' },
            ].map((stat) => (
              <div key={stat.label}>
                <div style={{
                  fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)',
                  fontWeight: 700,
                  color: '#1f2937',
                  lineHeight: 1,
                  marginBottom: '0.5rem',
                }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: '0.95rem', color: '#6b7280' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* THE NINE PILLARS */}
        <section style={{ margin: '3rem 0' }}>
          <h2 style={{
            fontSize: '1.875rem',
            fontWeight: 700,
            color: '#1a1a1a',
            marginBottom: '0.5rem',
          }}>
            The Nine Pillars
          </h2>
          <p style={{
            fontSize: '1rem',
            color: '#6b7280',
            marginBottom: '1.5rem',
            maxWidth: '700px',
          }}>
            Each pillar is a deep investigation into one decision visitors have to make. Supporting articles drill into specific edge cases under each pillar.
          </p>
          <div className="pillars-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1.25rem',
          }}>
            {pillars.map((pillar) => (
              <a
                key={pillar._id}
                href={`/${pillar.slug.current}`}
                style={{
                  display: 'block',
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  textDecoration: 'none',
                  color: '#1f2937',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{
                  position: 'relative',
                  width: '100%',
                  height: '180px',
                  background: '#f3f4f6',
                }}>
                  {pillar.heroImage?.asset?.url ? (
                    <Image
                      src={urlFor(pillar.heroImage).width(500).height(300).format('webp').quality(80).fit('crop').url()}
                      alt={pillar.heroImage.alt || pillar.title}
                      fill
                      style={{ objectFit: 'cover' }}
                      sizes="(max-width: 768px) 100vw, 500px"
                      loading="lazy"
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                      fontSize: '2.5rem',
                      color: '#9ca3af',
                    }}>
                      🏛️
                    </div>
                  )}
                </div>
                <div style={{ padding: '1rem 1.25rem' }}>
                  <h3 style={{
                    fontSize: '1.05rem',
                    fontWeight: 600,
                    lineHeight: 1.3,
                    marginBottom: '0.5rem',
                    color: '#1f2937',
                  }}>
                    {pillar.title}
                  </h3>
                  {pillar.seoDescription && (
                    <p style={{
                      fontSize: '0.875rem',
                      color: '#6b7280',
                      lineHeight: 1.5,
                      margin: 0,
                    }}>
                      {pillar.seoDescription}
                    </p>
                  )}
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* METHODOLOGY */}
        <section style={{
          margin: '3rem 0',
          padding: '2rem',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#1a1a1a',
            marginBottom: '0.75rem',
          }}>
            Methodology
          </h2>
          <p style={{
            fontSize: '1rem',
            color: '#4b5563',
            lineHeight: 1.6,
            marginBottom: '1rem',
            maxWidth: '700px',
          }}>
            Every article in the program follows the same protocol: source aggregation, normalization, anomaly detection across four layers, manual cross-check, and publication only when the evidence threshold is met. We document the full methodology — what we measure, how we verify, what we exclude.
          </p>
          <a
            href="/methodology"
            style={{
              display: 'inline-block',
              fontSize: '0.95rem',
              fontWeight: 600,
              color: '#2563eb',
              textDecoration: 'none',
            }}
          >
            Read the full methodology →
          </a>
        </section>

        {/* DATASET */}
        <section style={{ margin: '3rem 0' }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#1a1a1a',
            marginBottom: '0.75rem',
          }}>
            The Dataset
          </h2>
          <p style={{
            fontSize: '1rem',
            color: '#4b5563',
            lineHeight: 1.6,
            marginBottom: '1.5rem',
            maxWidth: '700px',
          }}>
            Colosseum Tour Research Corpus 2026 is the evidence base behind every article in this program. It aggregates publicly available data from five independent sources, normalized into a single analysis-ready corpus.
          </p>

          <div className="dataset-grid" style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1.5rem',
          }}>
            <div style={{
              padding: '1.5rem',
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
            }}>
              <h3 style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: '#6b7280',
                marginBottom: '0.75rem',
              }}>
                Sources
              </h3>
              <ul style={{
                listStyle: 'disc',
                paddingLeft: '1.25rem',
                margin: 0,
                color: '#1f2937',
                fontSize: '0.95rem',
                lineHeight: 1.8,
              }}>
                <li>YouTube (video transcripts &amp; comments)</li>
                <li>TripAdvisor (visitor reviews)</li>
                <li>Google Maps (place reviews &amp; Q&amp;A)</li>
                <li>GetYourGuide (verified booking reviews)</li>
                <li>Trustpilot (operator-level reviews)</li>
              </ul>
            </div>

            <div style={{
              padding: '1.5rem',
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
            }}>
              <h3 style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: '#6b7280',
                marginBottom: '0.75rem',
              }}>
                Variables measured
              </h3>
              <ul style={{
                listStyle: 'disc',
                paddingLeft: '1.25rem',
                margin: 0,
                color: '#1f2937',
                fontSize: '0.95rem',
                lineHeight: 1.8,
              }}>
                <li>Tour rating (1–5)</li>
                <li>Tour price (USD/EUR)</li>
                <li>Tour duration (minutes)</li>
                <li>Review sentiment</li>
                <li>Reviewer nationality</li>
                <li>Guide mentions</li>
                <li>Operator name</li>
              </ul>
            </div>
          </div>

          <p style={{
            marginTop: '1.5rem',
            fontSize: '0.875rem',
            color: '#6b7280',
          }}>
            Licensed under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>CC BY 4.0</a>. Temporal coverage: 2020–2026.
          </p>
        </section>

        {/* AUTHOR BOX FULL */}
        <section style={{ margin: '3rem 0' }}>
          <AuthorBox author="curator-team" variant="full" />
        </section>
      </Container>

      <Footer />

      <style>{`
        @media (max-width: 768px) {
          .research-numbers-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .pillars-grid {
            grid-template-columns: 1fr !important;
          }
          .dataset-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
