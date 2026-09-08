// app/pages/[category]/page.tsx
import { notFound } from 'next/navigation'
import { client } from '@/sanity/lib/client'
import { urlFor } from '@/sanity/lib/image'
import Image from 'next/image'
import Link from 'next/link'
import Container from '@/app/components/Container'
import Footer from '@/app/components/Footer'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import RecommendedTours from '@/app/components/blog/RecommendedTours'
import { getRecommendedTours } from '@/lib/getRecommendedTours';

interface PageCategoryData {
  title: string
  slug: { current: string }
  description: string
  image: {
    asset: { url: string }
    alt: string
  }
  color: string
  seoTitle?: string
  seoDescription?: string
}

interface CategoryPage {
  title: string
  slug: { current: string }
  seoDescription?: string
  heroImage?: {
    asset: { url: string }
    alt?: string
  }
  publishedAt?: string
}

async function getCategoryWithPages(slug: string) {
  const query = `
    {
      "category": *[_type == "pageCategory" && slug.current == $slug][0] {
        title,
        slug,
        description,
        image {
          asset->{
            _id,
            _ref,
            _type,
            url
          },
          alt
        },
        color,
        seoTitle,
        seoDescription
      },
      "pages": *[_type == "page" && references(*[_type == "pageCategory" && slug.current == $slug]._id)] {
        title,
        slug,
        seoDescription,
        heroImage {
          asset->{
            _id,
            _ref,
            _type,
            url
          },
          alt
        },
        publishedAt,
        _updatedAt
      } | order(publishedAt desc)
    }
  `

  return await client.fetch(query, { slug })
}



export async function generateMetadata({
  params
}: {
  params: { category: string }
}) {
  const { category: categoryData } = await getCategoryWithPages(params.category)

  if (!categoryData) {
    return {
      title: 'Category not found'
    }
  }

  return {
    title: categoryData.seoTitle || `${categoryData.title} | LasVegasTour`,
    description: categoryData.seoDescription || categoryData.description,
    openGraph: {
      title: categoryData.seoTitle || categoryData.title,
      description: categoryData.seoDescription || categoryData.description,
      images: categoryData.image?.asset?.url ? [{
        url: urlFor(categoryData.image).width(1200).height(630).url(),
        alt: categoryData.image.alt || categoryData.title
      }] : []
    }
  }
}

export default async function PageCategoryPage({
  params
}: {
  params: { category: string }
}) {
  const { category, pages } = await getCategoryWithPages(params.category)
  const recommendedTours = await getRecommendedTours()

  if (!category) {
    notFound()
  }

  // Color mapping para estilos
  const getColorStyles = (color: string) => {
    const colorMap: Record<string, { bg: string; border: string; accent: string }> = {
      blue: { bg: 'bg-blue-50', border: 'border-blue-200', accent: '#2563eb' },
      green: { bg: 'bg-green-50', border: 'border-green-200', accent: '#059669' },
      purple: { bg: 'bg-purple-50', border: 'border-purple-200', accent: '#7c3aed' },
      orange: { bg: 'bg-orange-50', border: 'border-orange-200', accent: '#ea580c' },
      red: { bg: 'bg-red-50', border: 'border-red-200', accent: '#dc2626' },
      gray: { bg: 'bg-gray-50', border: 'border-gray-200', accent: '#6b7280' }
    }
    return colorMap[color] || colorMap.blue
  }

  const colorStyles = getColorStyles(category.color)

  return (
    <div style={{ background: '#fafafa', minHeight: '100vh' }}>

      <Container>
        {/* TÍTULO - ESPACIO MÍNIMO DESDE HEADER */}
        <h1 style={{
          fontSize: 'clamp(2rem, 5vw, 3rem)',
          fontWeight: 'bold',
          marginBottom: '0.5rem',
          color: '#1a1a1a',
          lineHeight: '1.1',
          marginTop: '0.5rem'
        }}>
          {category.title}
        </h1>

        {/* BREADCRUMBS - MUY CERCA DEL TÍTULO */}
        <div style={{ marginBottom: '0.75rem' }}>
          <Breadcrumbs items={[
            { label: 'Home', href: '/' },
            { label: category.title, isActive: true }
          ]} />
        </div>

        {/* META DESCRIPCIÓN - ESPACIO MÍNIMO */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1rem'
        }}>
          <span style={{ fontSize: '1.2rem' }}>📄</span>
          <span style={{
            fontSize: '1.1rem',
            color: '#666',
            lineHeight: '1.6'
          }}>
            {category.description}
          </span>
        </div>

        {/* HERO IMAGE CON CONTAINER Y BORDER RADIUS */}
        <div style={{ position: 'relative', height: '400px', overflow: 'hidden', marginBottom: '3rem', borderRadius: '16px' }}>
          {category.image?.asset?.url ? (
            <Image
              src={urlFor(category.image).width(1200).height(400).format('webp').quality(85).fit('crop').url()}
              alt={category.image.alt}
              fill
              style={{ objectFit: 'cover' }}
              priority
            />
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              background: `linear-gradient(135deg, ${colorStyles.accent}, ${colorStyles.accent}dd)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{ fontSize: '4rem', color: 'white', opacity: 0.8 }}>
                📚
              </div>
            </div>
          )}
        </div>
      </Container>

      <Container>

        {/* Lista de páginas - Layout tablón */}
        <div style={{ marginBottom: '4rem' }}>
          {pages && pages.length > 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2rem'
            }}>
              {pages.map((page: CategoryPage) => (
                <article
                  key={page.slug.current}
                  style={{
                    background: 'white',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                  }}
                  className="page-article-hover"
                >
                  <Link href={`/${page.slug.current}`} style={{ textDecoration: 'none' }}>
                    <div
                      className="page-grid"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '250px 1fr',
                        alignItems: 'stretch',
                        minHeight: '180px'
                      }}
                    >

                      {/* Imagen */}
                      <div style={{
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        overflow: 'hidden',
                        borderTopRightRadius: '16px',
                        borderBottomRightRadius: '16px'
                      }}>
                        {page.heroImage && page.heroImage.asset && page.heroImage.asset.url ? (
                          <Image
                            src={urlFor(page.heroImage).width(250).height(180).format('webp').quality(85).fit('crop').url()}
                            alt={page.heroImage.alt || page.title}
                            fill
                            style={{ objectFit: 'cover' }}
                            sizes="250px"
                          />
                        ) : (
                          <div style={{
                            width: '100%',
                            height: '100%',
                            background: `linear-gradient(135deg, ${colorStyles.accent}20, ${colorStyles.accent}40)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '3rem'
                          }}>
                            📄
                          </div>
                        )}
                      </div>

                      {/* Contenido */}
                      <div style={{ padding: '2rem' }}>
                        <h2 style={{
                          fontSize: '1.5rem',
                          fontWeight: '700',
                          color: '#1a1a1a',
                          marginBottom: '1rem',
                          lineHeight: '1.3'
                        }}>
                          {page.title}
                        </h2>

                        {page.seoDescription && (
                          <p style={{
                            color: '#666',
                            lineHeight: '1.6',
                            marginBottom: '1.5rem',
                            fontSize: '1rem'
                          }}>
                            {page.seoDescription.length > 150
                              ? `${page.seoDescription.substring(0, 150)}...`
                              : page.seoDescription
                            }
                          </p>
                        )}

                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <span style={{
                            display: 'inline-block',
                            background: colorStyles.accent,
                            color: 'white',
                            padding: '8px 16px',
                            borderRadius: '20px',
                            fontSize: '0.9rem',
                            fontWeight: '600'
                          }}>
                            Read More →
                          </span>


                        </div>
                      </div>

                    </div>
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '4rem 2rem',
              background: 'white',
              borderRadius: '16px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
            }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔭</div>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '1rem'
              }}>
                No pages in this category yet
              </h3>
              <p style={{ color: '666', marginBottom: '2rem' }}>
                Check back soon for new content in "{category.title}"
              </p>
              <Link
                href="/"
                style={{
                  display: 'inline-block',
                  background: colorStyles.accent,
                  color: 'white',
                  padding: '12px 24px',
                  borderRadius: '25px',
                  textDecoration: 'none',
                  fontWeight: '600'
                }}
              >
                Back to Home
              </Link>
            </div>
          )}
        </div>

      </Container>

      {/* RECOMMENDED TOURS */}
      <Container>
        <RecommendedTours tours={recommendedTours} />
      </Container>

      <Footer />

      {/* CSS para responsive y hover effects */}
      <style suppressHydrationWarning>
        {`
          @media (max-width: 768px) {
            .page-grid {
              grid-template-columns: 1fr !important;
            }

            .page-grid > div:first-child {
              height: 180px !important;
            }
          }

          .page-article-hover:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 30px rgba(0,0,0,0.12);
          }
        `}
      </style>
    </div>
  )
}