import { client } from '@/sanity/lib/client';
import { urlFor } from '@/sanity/lib/image';
import Image from 'next/image';
import Link from 'next/link';
import Container from '@/app/components/Container';
import Footer from '@/app/components/Footer';
import type { Metadata } from 'next';

const cacheConfig = {
  next: { revalidate: 3600 },
};

// 🔧 Orden de las categorías en la grilla. Mové los slugs para reordenar.
const CATEGORY_ORDER = [
  'grand-canyon-tours',
  'helicopter-tours',
  'shows',
  'strip-tours',
  'day-trips',
  'hoover-dam-tours',
  'adventure-tours',
  'nightlife',
];

const SITE_URL = 'https://lasvegastour.com';

// 🔧 Experiencias destacadas (curadas): 2 hubs + 1 tour estrella.
// imageSlug = de qué tour sacar la foto representativa.
const FEATURED = [
  {
    title: 'Cirque du Soleil Shows',
    subtitle: '5 resident shows on the Strip',
    href: '/cirque-du-soleil-shows-las-vegas',
    imageSlug: 'o-cirque-du-soleil-aquatic-theater-show-bellagio-vegas',
  },
  {
    title: 'The Sphere',
    subtitle: 'The 16K immersive venue',
    href: '/sphere-las-vegas-shows',
    imageSlug: 'wizard-of-oz-sphere-las-vegas-4d-show-experience',
  },
  {
    title: 'The High Roller',
    subtitle: '550 ft observation wheel',
    href: '/tour/high-roller-observation-wheel-linq-admission-ticket',
    imageSlug: 'high-roller-observation-wheel-linq-admission-ticket',
  },
];

async function getCategories() {
  const query = `*[_type == "category"]{
    title,
    slug,
    "image": image{ asset->{ url }, alt },
    "count": count(*[_type == "post" && references(^._id) && discontinued != true]),
    "fallbackImage": *[_type == "post" && references(^._id) && discontinued != true]
      | order(getYourGuideData.reviewCount desc)[0]{
        "hero": heroGallery[0]{ asset->{ url }, alt },
        "seo": seoImage{ asset->{ url }, alt }
      }
  }`;

  const result = await client.fetch(query, {}, cacheConfig);
  return Array.isArray(result) ? result : [];
}

async function getFeaturedImages() {
  const slugs = FEATURED.map((f) => f.imageSlug);
  const query = `*[_type == "post" && slug.current in $slugs]{
    "slug": slug.current,
    "image": heroGallery[0]{ asset->{ url }, alt }
  }`;
  const res = await client.fetch(query, { slugs }, cacheConfig);
  const bySlug: Record<string, any> = {};
  (Array.isArray(res) ? res : []).forEach((r: any) => {
    if (r?.slug) bySlug[r.slug] = r.image;
  });
  return bySlug;
}

function getCategoryImage(cat: any) {
  if (cat?.image?.asset?.url) return cat.image;
  if (cat?.fallbackImage?.hero?.asset?.url) return cat.fallbackImage.hero;
  if (cat?.fallbackImage?.seo?.asset?.url) return cat.fallbackImage.seo;
  return null;
}

function sortCategories(cats: any[]) {
  return [...cats].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a?.slug?.current);
    const ib = CATEGORY_ORDER.indexOf(b?.slug?.current);
    const ra = ia === -1 ? Number.MAX_SAFE_INTEGER : ia;
    const rb = ib === -1 ? Number.MAX_SAFE_INTEGER : ib;
    if (ra !== rb) return ra - rb;
    return (b?.count || 0) - (a?.count || 0);
  });
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Las Vegas Tours & Shows by Category | LasVegasTour',
    description:
      'Browse every Las Vegas experience by category: Grand Canyon and helicopter tours, day trips, Cirque du Soleil shows, the Sphere, Strip tours, Hoover Dam, adventure and nightlife.',
    alternates: { canonical: `${SITE_URL}/tours` },
    openGraph: {
      title: 'Las Vegas Tours & Shows by Category',
      description:
        'Find the right Las Vegas experience by category and book the best-rated tours and shows.',
      url: `${SITE_URL}/tours`,
      type: 'website',
    },
  };
}

export default async function ToursIndexPage() {
  const [raw, featuredImages] = await Promise.all([getCategories(), getFeaturedImages()]);
  const categories = sortCategories(raw.filter((c: any) => (c?.count || 0) > 0));

  const totalTours = categories.reduce((sum: number, c: any) => sum + (c?.count || 0), 0);

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Las Vegas Tours & Shows',
    url: `${SITE_URL}/tours`,
    description: 'All Las Vegas tours and shows, organized by category for easy browsing.',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: categories.length,
      itemListElement: categories.map((c: any, i: number) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.title,
        url: `${SITE_URL}/tours/${c?.slug?.current}`,
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .lv-cat-card { transition: transform .25s ease, box-shadow .25s ease; }
        .lv-cat-card:hover { transform: translateY(-4px); box-shadow: 0 14px 32px rgba(0,0,0,0.18); }
        .lv-cat-card .lv-cat-img { transition: transform .4s ease; }
        .lv-cat-card:hover .lv-cat-img { transform: scale(1.06); }
      `,
        }}
      />

      <Container>
        <div style={{ padding: '32px 0 8px' }}>
          <nav style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '14px' }}>
            <Link href="/" style={{ color: '#6b7280', textDecoration: 'none' }}>
              Home
            </Link>
            <span style={{ margin: '0 8px' }}>/</span>
            <span style={{ color: '#374151' }}>Tours &amp; Shows</span>
          </nav>

          <h1
            style={{
              fontSize: '2.1rem',
              fontWeight: 700,
              color: '#1a1a1a',
              lineHeight: 1.2,
              margin: '0 0 12px',
            }}
          >
            Las Vegas Tours &amp; Shows
          </h1>

          <p
            style={{
              fontSize: '1.05rem',
              color: '#4b5563',
              lineHeight: 1.6,
              maxWidth: '760px',
              margin: '0 0 28px',
            }}
          >
            Browse every Las Vegas experience by category. From Grand Canyon and
            helicopter tours to Cirque du Soleil shows, the Sphere, Strip tours,
            Hoover Dam day trips, and nightlife &mdash; {totalTours} tours and
            shows across {categories.length} categories, each leading to the
            best-rated options in that group.
          </p>
        </div>

        {/* ===== Franja destacada: experiencias icónicas ===== */}
        <div style={{ paddingBottom: '12px' }}>
          <h2
            style={{
              fontSize: '1.35rem',
              fontWeight: 700,
              color: '#1a1a1a',
              margin: '0 0 16px',
            }}
          >
            Iconic Las Vegas experiences
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '20px',
              marginBottom: '44px',
            }}
          >
            {FEATURED.map((f) => {
              const img = featuredImages[f.imageSlug];
              return (
                <Link
                  key={f.href}
                  href={f.href}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div
                    className="lv-cat-card"
                    style={{
                      position: 'relative',
                      height: '240px',
                      borderRadius: '16px',
                      overflow: 'hidden',
                      background: '#111',
                    }}
                  >
                    {img ? (
                      <Image
                        className="lv-cat-img"
                        src={urlFor(img)
                          .width(700)
                          .height(480)
                          .format('webp')
                          .quality(80)
                          .fit('crop')
                          .url()}
                        alt={img.alt || f.title}
                        fill
                        style={{ objectFit: 'cover' }}
                        sizes="(max-width: 768px) 100vw, 33vw"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          background:
                            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        }}
                      />
                    )}

                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background:
                          'linear-gradient(to top, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 42%)',
                      }}
                    />

                    <span
                      style={{
                        position: 'absolute',
                        top: '12px',
                        left: '12px',
                        background: '#e91e63',
                        color: '#fff',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        letterSpacing: '0.5px',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        textTransform: 'uppercase',
                      }}
                    >
                      Featured
                    </span>

                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        padding: '20px 22px',
                      }}
                    >
                      <h3
                        style={{
                          color: '#fff',
                          fontSize: '1.5rem',
                          fontWeight: 700,
                          lineHeight: 1.15,
                          margin: '0 0 3px',
                          textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                        }}
                      >
                        {f.title}
                      </h3>
                      <span
                        style={{
                          color: 'rgba(255,255,255,0.92)',
                          fontSize: '0.9rem',
                          fontWeight: 500,
                          textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                        }}
                      >
                        {f.subtitle}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ===== Grid de categorías ===== */}
        <h2
          style={{
            fontSize: '1.35rem',
            fontWeight: 700,
            color: '#1a1a1a',
            margin: '0 0 16px',
          }}
        >
          Browse by category
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '20px',
            paddingBottom: '48px',
          }}
        >
          {categories.map((cat: any) => {
            const img = getCategoryImage(cat);
            const isShow = cat?.slug?.current === 'shows';
            const noun = isShow ? 'shows' : 'tours';

            return (
              <Link
                key={cat?.slug?.current}
                href={`/tours/${cat?.slug?.current}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div
                  className="lv-cat-card"
                  style={{
                    position: 'relative',
                    height: '280px',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    background: '#111',
                  }}
                >
                  {img ? (
                    <Image
                      className="lv-cat-img"
                      src={urlFor(img)
                        .width(800)
                        .height(560)
                        .format('webp')
                        .quality(80)
                        .fit('crop')
                        .url()}
                      alt={img.alt || cat.title}
                      fill
                      style={{ objectFit: 'cover' }}
                      sizes="(max-width: 768px) 100vw, 50vw"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        background:
                          'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      }}
                    />
                  )}

                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background:
                        'linear-gradient(to top, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 42%)',
                    }}
                  />

                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      padding: '22px 24px',
                    }}
                  >
                    <h2
                      style={{
                        color: '#fff',
                        fontSize: '1.7rem',
                        fontWeight: 700,
                        lineHeight: 1.15,
                        margin: '0 0 4px',
                        textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                      }}
                    >
                      {cat.title}
                    </h2>
                    <span
                      style={{
                        color: 'rgba(255,255,255,0.92)',
                        fontSize: '0.95rem',
                        fontWeight: 500,
                        textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                      }}
                    >
                      {cat.count} {noun}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </Container>

      <Footer />
    </>
  );
}

