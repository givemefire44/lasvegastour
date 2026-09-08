import { Metadata } from 'next'
import Image from 'next/image'
import { client } from '@/sanity/lib/client'
import { urlFor } from '@/sanity/lib/image'
import Container from '@/app/components/Container'
import Footer from '@/app/components/Footer'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import AuthorBox from '@/app/components/AuthorBox'

const SITE_URL = 'https://lasvegastour.com'
const PAGE_URL = `${SITE_URL}/las-vegas-research`
const DATASET_ID = `${PAGE_URL}#dataset`
const COLLECTION_ID = `${PAGE_URL}#collection`
const INTERCOPER_ID = 'https://intercoper.com/#organization'

export const metadata: Metadata = {
  title: 'The Las Vegas Research Program | LasVegasTour',
  description: 'Original research on Las Vegas shows and tours. 27,066 items analyzed across 3 independent sources, covering both the decision before booking and the verdict after the night.',
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: 'website',
    url: PAGE_URL,
    title: 'The Las Vegas Research Program',
    description: 'Original research on Las Vegas shows and tours.',
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
  // El guard de drafts NO es opcional: sin el, un pilar con cambios sin
  // publicar aparece DUPLICADO en el grid, y un pilar todavia en borrador se
  // muestra como si estuviera publicado.
  const query = `*[_type == "page" && isPillar == true && !(_id in path("drafts.**"))] | order(title asc) {
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

export default async function LasVegasResearchPage() {
  const pillars = await getPillars()

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${PAGE_URL}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Las Vegas Research', item: PAGE_URL },
    ],
  }

  const datasetSchema = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    '@id': DATASET_ID,
    name: 'Las Vegas Shows and Tours Research Corpus',
    alternateName: 'Las Vegas Research Corpus',
    description: 'Curated corpus of 27,066 items related to Las Vegas shows, helicopter tours and day trips, gathered from three independent sources (Reddit, YouTube, TripAdvisor). Covers two stages of the traveler journey: pre-purchase deliberation from public forums, and post-visit reviews. 4,836 items were processed for topic, sentiment and claims; 4,837 carry a star rating, all of them from TripAdvisor across 11 venue listings. Reddit and YouTube carry no star ratings, so every comparison between what people expected and what they scored comes from the TripAdvisor layer. Reviews were collected in two separate passes, one unfiltered and one restricted to the 1-3 star tail, and the two are never averaged together. Version 1, September 2026.',
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
      name: 'LasVegasTour',
      url: SITE_URL,
    },
    datePublished: '2026-09-07',
    dateModified: new Date().toISOString().split('T')[0],
    inLanguage: 'en',
    isAccessibleForFree: true,
    license: 'https://creativecommons.org/licenses/by/4.0/',
    keywords: [
      'Las Vegas shows',
      'Las Vegas tours',
      'tourism research',
      'restaurant reviews',
      'visitor reviews',
      'tour quality',
    ],
    spatialCoverage: {
      '@type': 'Place',
      name: 'Las Vegas, Nevada, USA',
    },
    temporalCoverage: '2008-12-15/2026-09-05',
    variableMeasured: [
      'Review rating (1-5)',
      'Review sentiment',
      'Topic tags',
      'Pain points',
      'Verifiable claims',
      'Questions raised',
      'Source platform',
      'Publication date',
      'Machine-translation flag',
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
    name: 'The Las Vegas Research Program',
    description: `Original research on Las Vegas shows and tours. ${pillars.length} evidence-based pillars, each built on the same dated corpus of reviews and forum discussion.`,
    url: PAGE_URL,
    isPartOf: {
      '@type': 'WebSite',
      '@id': `${SITE_URL}#website`,
      name: 'LasVegasTour',
      url: SITE_URL,
    },
    about: {
      '@type': 'TouristAttraction',
      '@id': `${SITE_URL}#las-vegas`,
      name: 'Las Vegas',
      sameAs: 'https://en.wikipedia.org/wiki/Las_Vegas',
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
        <Breadcrumbs noSchema items={[
          { label: 'Home', href: '/' },
          { label: 'Las Vegas Research', href: '/las-vegas-research', isActive: true },
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
            The Las Vegas Research Program
          </h1>
          <p style={{
            fontSize: 'clamp(1.1rem, 2.5vw, 1.4rem)',
            color: '#4b5563',
            lineHeight: 1.5,
            maxWidth: '760px',
            marginBottom: '1.5rem',
          }}>
            Original research on Las Vegas shows and tours.
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
              { value: '27,066', label: 'Items analyzed' },
              { value: '3', label: 'Independent sources' },
              { value: '2', label: 'Journey stages covered' },
              { value: '4,837', label: 'Reviews with a star rating' },
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

        {/* LOS PILARES — la cantidad se deriva, no se escribe */}
        <section style={{ margin: '3rem 0' }}>
          <h2 style={{
            fontSize: '1.875rem',
            fontWeight: 700,
            color: '#1a1a1a',
            marginBottom: '0.5rem',
          }}>
            {/* Derivado, no escrito a mano: en trastevere decia "Nine" con 2
                pilares publicados. Una cifra hardcodeada envejece sola.
                El plural TAMBIEN se deriva: lasvegas arranca con un solo pilar
                y "The 1 Pillars" quedaba escrito en la pagina. */}
            {pillars.length === 1 ? 'The First Pillar' : `The ${pillars.length} Pillars`}
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
            Every article in the program follows the same protocol: source aggregation, normalization, anomaly detection across four layers, manual cross-check, and publication only when the evidence threshold is met. Each article carries its own method note stating what was measured, over how many reviews, and what the sample cannot answer.
          </p>
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
            The Las Vegas Research Corpus is the evidence base behind every article in this program: 27,066 items gathered from three independent platforms between December 2008 and September 2026, of which 4,836 were processed for topic, sentiment and claims. The rated layer &mdash; 4,837 reviews across 11 venue listings &mdash; was collected in two separate passes, one unfiltered and one restricted to the 1-3 star tail, and the two are never averaged together. Every figure published on this site traces back to it.
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
                <li>Reddit (pre-purchase discussion, 2008&ndash;2026)</li>
                <li>YouTube (video transcripts &amp; comments)</li>
                <li>TripAdvisor (visitor reviews, 11 venue listings)</li>
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
                <li>Review rating (1–5)</li>
                <li>Topic tags</li>
                <li>Pain points</li>
                <li>Review sentiment</li>
                <li>Verifiable claims</li>
                <li>Publication date</li>
                <li>Machine-translation flag</li>
              </ul>
            </div>
          </div>

          <p style={{
            marginTop: '1.5rem',
            fontSize: '0.875rem',
            color: '#6b7280',
          }}>
            Licensed under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>CC BY 4.0</a>. Temporal coverage: December 2008 – September 2026.
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
