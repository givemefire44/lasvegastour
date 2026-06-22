'use client'
import { PortableText } from '@portabletext/react';
import { urlFor } from '@/sanity/lib/image';
import Image from 'next/image';
import { useEffect } from 'react';
import TourImageRow from './TourImageRow';



// Función para generar IDs automáticamente
function generateSectionId(children: any): string {
  if (!children) return '';
  
  let text = '';
  if (typeof children === 'string') {
    text = children;
  } else if (Array.isArray(children)) {
    text = children.map(child => 
      typeof child === 'string' ? child : (child?.props?.children || '')
    ).join(' ');
  }

  const cleanText = text.toLowerCase().trim();

  if (cleanText.includes('detail')) return 'details';
  if (cleanText.includes('cancel')) return 'cancellations';

  return '';
}

// ✅ FUNCIÓN PARA DETECTAR SI HAY FORMATO (strong, em, etc)
function hasFormattedContent(children: any): boolean {
  if (!children) return false;
  if (typeof children === 'string') return false;
  if (Array.isArray(children)) {
    return children.some(child => typeof child !== 'string');
  }
  return true;
}

interface SanityContentProps {
  post: {
    title: string;
    seoTitle?: string;
    quickAnswerQuestion?: string;
    slug?: {
      current: string;
    };
    mainImage?: {
      asset: {
        url: string;
      };
      alt?: string;
    };
    body?: any;
    heroGallery?: any;
    content?: any;
    tourInfo?: any;
    tourFeatures?: any;
    getYourGuideData?: any;
    aiCitable?: {
      phrase?: string;
      pattern?: string;
      generatedAt?: string;
    };
  };
  relatedTours?: any[];
  noTableSchema?: boolean;
}

export default function SanityContent({ post, relatedTours = [], noTableSchema = false }: SanityContentProps) {
  const tourSlug = post.slug?.current;

  const excludedSlugs = ['about-us', 'contact-us', 'privacy-policy'];
  const isExcludedPage = tourSlug ? excludedSlugs.includes(tourSlug) : false;  

  useEffect(() => {
    const handleSmartLink = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('.smart-booking-link') as HTMLAnchorElement; 

      if (link) {
        const linkUrl = new URL(link.href);
        const currentUrl = new URL(window.location.href);

        if (linkUrl.pathname === currentUrl.pathname) {
          e.preventDefault();

          const comparisonTable = document.getElementById('comparison-table'); 

          if (comparisonTable) {
            const elementPosition = comparisonTable.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - 100; 

            window.scrollTo({
              top: offsetPosition,
              behavior: 'smooth'
            });
          } else {
            const bookingSection = document.getElementById('book-now');        
            if (bookingSection) {
              const elementPosition = bookingSection.getBoundingClientRect().top;
              const offsetPosition = elementPosition + window.pageYOffset - 80;

              window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
              });
            }
          }
        }
      }
    };

    document.addEventListener('click', handleSmartLink);
    return () => document.removeEventListener('click', handleSmartLink);       
  }, []);

  const contentToRender = post.content || post.body;

  // Pre-procesar bloques para marcar el párrafo que sigue al Quick Answer header
  const processedContent = Array.isArray(contentToRender)
    ? contentToRender.map((block: any, i: number) => {
        if (block._type === 'block' && block.style === 'normal') {
          const prev = contentToRender[i - 1];
          if (prev?._type === 'block' && prev?.style === 'h3') {
            const prevText = prev.children?.map((c: any) => c.text || '').join('') || '';
            const cleanedText = prevText.replace(/💡\s*/g, '').replace(/🎯\s*/g, '').replace(/Quick Answer:?\s*/i, '').trim();
            // Solo nuevo formato: h3 que es SOLO "Quick Answer" sin contenido adicional
            if (prevText.includes('Quick Answer') && cleanedText === '') {
              return { ...block, _isQuickAnswerBody: true };
            }
          }
        }
        return block;
      })
      .filter((block: any) => {
        const text = block.children?.map((c: any) => c.text || '').join('') || '';
        if (text.trim().startsWith('|') || text.trim().startsWith('---')) return false;
        if ((block.style === 'h2' || block.style === 'h3') && text.toLowerCase().includes('compare')) return false;
        return true;
      })
      : contentToRender;

  // Agrupa el cuerpo de "Why People Book This" y "Is It Worth It?" en una caja gris (#E8EDF3).
  const GRAY_HEADER_RX = /why people book this|is it worth it/i;
  const isHeadingBlock = (b: any) => b?._type === 'block' && ['h1', 'h2', 'h3', 'h4'].includes(b.style);
  const blockHeadingText = (b: any) => (b?.children?.map((c: any) => c.text || '').join('') || '');
  const finalContent = Array.isArray(processedContent)
    ? (() => {
        const out: any[] = [];
        for (let i = 0; i < processedContent.length; i++) {
          const b = processedContent[i];
          if (isHeadingBlock(b) && GRAY_HEADER_RX.test(blockHeadingText(b))) {
            const isWorthIt = /is it worth it/i.test(blockHeadingText(b));
            out.push(b);
            const inner: any[] = [];
            let j = i + 1;
            while (j < processedContent.length && !isHeadingBlock(processedContent[j])) {
              inner.push(processedContent[j]); j++;
            }
            if (inner.length) out.push({ _type: 'grayBox', _key: `graybox-${i}`, blocks: inner });
            if (isWorthIt) out.push({ _type: 'imageRow', _key: `imagerow-${i}` });
            i = j - 1;
          } else { out.push(b); }
        }
        return out;
      })()
    : processedContent;

  const components: any = {
    types: {
      image: ({ value }: any) => {
        if (!value?.asset?._ref && !value?.asset?._id && !value?.asset?.url) { 
          return null;
        }

        return (
          <div style={{ position: 'relative', width: '100%', height: '400px', margin: '30px 0', borderRadius: '12px', overflow: 'hidden' }}>
            <Image
              src={urlFor(value).width(800).height(400).format('webp').quality(85).fit('crop').url()}
              alt={value.alt || 'Imagen del contenido'}
              fill
              style={{ objectFit: 'cover' }}
              sizes="(max-width: 768px) 100vw, 800px"
              loading="lazy"
              placeholder="blur"
              blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
            />
            {value.caption && <p className="image-caption">{value.caption}</p>}
          </div>
        );
      },

      imageGallery: ({ value }: any) => {
        if (!value?.images || value.images.length === 0) return null;

        const layout = value.layout || 'grid-2';

        return (
          <div className="image-gallery-container">
            {value.title && <h3 className="gallery-title">{value.title}</h3>}  
            <div className={`gallery-grid gallery-${layout}`}>
              {value.images.map((image: any, index: number) => (
                <div key={index} className="gallery-item">
                  <div style={{ position: 'relative', width: '100%', height: '250px', borderRadius: '8px', overflow: 'hidden' }}>
                    <Image
                      src={urlFor(image).width(400).height(250).format('webp').quality(80).fit('crop').url()}
                      alt={image.alt || image.caption || `Gallery image ${index + 1}`}
                      fill
                      style={{ objectFit: 'cover' }}
                      sizes="(max-width: 768px) 100vw, 400px"
                      loading="lazy"
                      placeholder="blur"
                      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                    />
                  </div>
                  {image.caption && <p className="gallery-caption">{image.caption}</p>}
                </div>
              ))}
            </div>
          </div>
        );
      },

      simpleTable: ({ value }: any) => {
       

        const headerRow = value.rows[0];
        const dataRows = value.rows.slice(1);

        const renderCellWithLink = (cellText: string, columnIndex: number) => {
          if (columnIndex !== 0) return cellText;

          const slugMatch = cellText.match(/\[SLUG:([^\]]+)\]/);

          if (slugMatch) {
            const slug = slugMatch[1];
            const visibleText = cellText.replace(/\[SLUG:[^\]]+\]/, '').trim();

            return (
              <a href={`/tour/${slug}`} className="tour-comparison-link">      
                {visibleText}
              </a>
            );
          }

          return cellText;
        };

        return (
          <div className="table-container" id="comparison-table">
            {value.title && <h3 className="table-title">{value.title}</h3>}    

            <div className="simple-table-desktop">
              <table className="simple-table" role="table" aria-label="Tour comparison table">
                <thead>
                  <tr>
                    {headerRow?.cells?.map((cell: string, cellIndex: number) => (
                      <th key={cellIndex} scope="col">{cell}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataRows.map((row: any, rowIndex: number) => (
                    <tr key={rowIndex}>
                      {row.cells && row.cells.map((cell: string, cellIndex: number) => (
                        <td key={cellIndex}>{renderCellWithLink(cell, cellIndex)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="simple-table-mobile">
              {dataRows.map((row: any, rowIndex: number) => (
                <div key={rowIndex} className="table-card">
                  {row.cells && row.cells.map((cell: string, cellIndex: number) => (
                    <div key={cellIndex} className="table-card-row">
                      <span className="table-card-label">
                        {headerRow?.cells?.[cellIndex] || ''}
                      </span>
                      <span className="table-card-value">
                        {renderCellWithLink(cell, cellIndex)}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      },

      grayBox: ({ value }: any) => (
        <div className="why-worth-graybox" style={{ background: '#E8EDF3', borderRadius: '10px', padding: '20px 28px', margin: '0 0 1.5rem 0' }}>
          <PortableText value={value.blocks} components={components} />
        </div>
      ),
      imageRow: () => (
        <TourImageRow images={(post.heroGallery || []).slice(1)} title={post.title} />
      ),
    },
    block: {
      h1: ({ children }: any) => {
        const id = generateSectionId(children);
        return <h2 id={id || undefined} className="content-h1">{children}</h2>;
      },
      blockquote: ({ children }: any) => (
        <blockquote style={{
          borderLeft: '4px solid #5f6368',
          background: '#e8eaed',
          margin: '28px 0',
          padding: '12px 22px',
          fontSize: '1rem',
          lineHeight: '1.7',
          fontWeight: 400,
          color: '#333',
          fontStyle: 'normal',
          borderRadius: '0 8px 8px 0',
        }}>
          {children}
        </blockquote>
      ),
      h2: ({ children }: any) => {
        const id = generateSectionId(children);
        return <h3 id={id || undefined} className="content-h2">{children}</h3>;
      },
      h3: ({ children }: any) => {
        const id = generateSectionId(children);

        let textContent = '';
        if (typeof children === 'string') {
          textContent = children;
        } else if (Array.isArray(children)) {
          textContent = children.map((c: any) => {
            if (typeof c === 'string') return c;
            if (c?.props?.children) return c.props.children;
            return '';
          }).join('');
        }

        if (textContent.includes('Quick Answer')) {
          const content = textContent
            .replace(/💡\s*/g, '')
            .replace(/🎯\s*/g, '')
            .replace(/Quick Answer:?\s*/i, '')
            .replace(/\*\*/g, '')
            .trim();

          // Nuevo formato: header vacío, contenido en párrafo siguiente
          if (!content) {
            return (
              <div style={{
                margin: '1.5rem 0 0 0',
                padding: '14px 20px 9px 20px',
                background: '#1e3a5f',
                borderRadius: '8px 8px 0 0',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                fontSize: '1.02rem',
                fontWeight: 700,
                color: '#ffffff',
                lineHeight: 1.4
              }}>
                <span style={{ fontSize: '1.05rem' }}>💡</span>
                <span>{post.quickAnswerQuestion || `What is the ${post.seoTitle || post.title}?`}</span>
              </div>
            );
          }

          // Formato viejo: detectar patrón "Is X? Yes — descripción"
          const match = content.match(/^(Is [^?]+\?)\s*(Yes)\s*[,\u2014\u2013\-]*\s*([\s\S]*)$/i);

          if (match) {
            const question = match[1];
            const answer = match[2];
            const description = match[3];

            return (
              <div style={{
                margin: '1rem 0 1.5rem 0',
                padding: '0.75rem 1rem',
                background: '#f8fdf8',
                borderLeft: '3px solid #4caf50',
                borderRadius: '4px'
              }}>
                <div style={{ margin: '0 0 0.25rem 0', fontSize: '0.95rem', fontWeight: 600, color: '#333' }}>
                  <span style={{ marginRight: '6px' }}>💡</span>
                  {question}
                </div>
                <div style={{ margin: 0, fontSize: '0.95rem', color: '#333', lineHeight: 1.5 }}>
                  <strong>{answer}</strong> — {description}
                </div>
                <a
                  href={`https://lasvegastour.com/tour/${tourSlug}`}
                  className="smart-booking-link"
                  style={{ display: 'inline-block', marginTop: '10px', fontSize: '0.9rem', color: '#2e7d32', fontWeight: 700, textDecoration: 'none' }}
                >
                  Check availability &amp; secure your spot →
                </a>
              </div>
            );
          }

          // Formato viejo: contenido plano dentro del h3
          return (
            <div style={{
              margin: '1rem 0 1.5rem 0',
              padding: '0.75rem 1rem',
              background: '#f8fdf8',
              borderLeft: '3px solid #4caf50',
              borderRadius: '4px'
            }}>
              <div style={{ margin: 0, fontSize: '0.95rem', color: '#333', lineHeight: 1.5 }}>
                <span style={{ marginRight: '6px' }}>💡</span>
                {content}
              </div>
              <a
                href={`https://lasvegastour.com/tour/${tourSlug}`}
                className="smart-booking-link"
                style={{ display: 'inline-block', marginTop: '10px', fontSize: '0.9rem', color: '#2e7d32', fontWeight: 700, textDecoration: 'none' }}
              >
                Check availability &amp; secure your spot →
              </a>
            </div>
          );
        }

        return <h4 id={id || undefined} className="content-h3">{children}</h4>;
      },
      h4: ({ children }: any) => {
        const id = generateSectionId(children);
        return <h5 id={id || undefined} className="content-h4">{children}</h5>;
      },

      normal: ({ children, value }: any) => {
        if (value?._isQuickAnswerBody) {
          return (
            <>
              <div className="qa-body-navy" style={{
                margin: '0 0 0 0',
                padding: '0.75rem 1.25rem 1rem 1.25rem',
                background: '#1e3a5f',
                borderRadius: '0 0 8px 8px',
                lineHeight: 1.7,
                color: '#eef2f7'
              }}>
                {children}
              </div>
              {post.aiCitable?.phrase && (
                <div style={{
                  margin: '0.5rem 0 1.5rem 0',
                  padding: '0.75rem 1rem',
                  background: '#f5f5f5',
                  borderLeft: '3px solid #9e9e9e',
                  borderRadius: '0 4px 4px 0',
                  fontSize: '0.92rem',
                  fontStyle: 'italic',
                  color: '#555',
                  lineHeight: 1.5
                }}>
                  {post.aiCitable.phrase}
                </div>
              )}
            </>
          );
        }
        return (
          <div className="content-paragraph">
          {children}
        </div>
        );
      },
    },
    marks: {
      strong: ({ children }: any) => <strong>{children}</strong>,
      em: ({ children }: any) => <em>{children}</em>,
      link: ({ children, value }: any) => {
        const target = value?.blank ? '_blank' : '_self';
        const rel = value?.blank ? 'noopener noreferrer' : undefined;
        return (
          <a
            href={value?.href}
            target={target}
            rel={rel}
            style={{
              color: '#e91e63',
              textDecoration: 'underline',
              transition: 'color 0.2s ease'
            }}
          >
            {children}
          </a>
        );
      },
    },
  };

  return (
    <div className="sanity-container">
      <div className="sanity-content">
        {post.mainImage?.asset?.url && (
          <div style={{ position: 'relative', width: '100%', height: '400px', margin: '0 0 30px 0', borderRadius: '12px', overflow: 'hidden' }}>
            <Image
              src={urlFor(post.mainImage).width(800).height(400).format('webp').quality(90).fit('crop').url()}
              alt={post.mainImage.alt || post.title}
              fill
              style={{ objectFit: 'cover' }}
              sizes="(max-width: 768px) 100vw, 800px"
              priority={true}
              placeholder="blur"
              blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
            />
          </div>
        )}

{finalContent && (
          <PortableText value={finalContent} components={components} />
        )}

       <style jsx global>{`
          .sanity-container {
            max-width: 100%;
            margin: 0 auto;
            padding: 0;
          }

          .sanity-content {
            width: 100%;
            line-height: 1.6;
            color: #333;
          }

       .content-paragraph {
            margin: 1rem 0;
            line-height: 1.6;
          }
          .why-worth-graybox > :first-child { margin-top: 0; }
          .why-worth-graybox > :last-child { margin-bottom: 0; }

          .content-h1, .content-h2, .content-h3, .content-h4 {
            margin: 1.5rem 0 1rem 0;
            color: #2c3e50;
            font-weight: 600;
          }

          .content-h1 { font-size: 2rem; }
          .content-h2 { font-size: 1.75rem; }
          .content-h3 { font-size: 1.5rem; }
          .qa-body-navy strong { color: #f4c95d; }
          .content-h4 { font-size: 1.25rem; }

          .image-caption, .gallery-caption {
            margin-top: 0.5rem;
            font-size: 0.9rem;
            color: #666;
            text-align: center;
            font-style: italic;
          }

          .image-gallery-container {
            margin: 2rem 0;
          }

          .gallery-title {
            margin-bottom: 1rem;
            color: #2c3e50;
            font-weight: 600;
          }

          .gallery-grid {
            display: grid;
            gap: 1.5rem;
          }

          .gallery-grid-2 {
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));       
          }

          .gallery-grid-3 {
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));       
          }

          .sanity-content .table-container {
            margin: 40px 0 !important;
          }

          .table-container .table-title {
            font-size: 1.3rem !important;
            font-weight: 700 !important;
            margin-bottom: 20px !important;
            color: #e91e63 !important;
            display: flex !important;
            align-items: center !important;
            gap: 10px !important;
          }

          .table-container .table-title::before {
            content: '📊';
            font-size: 1.3rem;
          }

          .table-container .simple-table {
            width: 100% !important;
            max-width: 580px !important;
            margin: 0 auto !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            background: white !important;
            border-radius: 12px !important;
            overflow: hidden !important;
            box-shadow: 0 2px 12px rgba(0,0,0,0.08) !important;
            font-size: 0.95rem !important;
          }

          .table-container .simple-table th:first-child,
          .table-container .simple-table td:first-child {
            width: 40% !important;
          }

          .table-container .simple-table th:nth-child(2),
          .table-container .simple-table td:nth-child(2) {
            width: 60% !important;
          }

          .table-container .simple-table tbody td:first-child {
            font-weight: 600 !important;
          }

          .table-container .simple-table th {
            padding: 14px 16px !important;
            background: #f8f9fa !important;
            font-weight: 600 !important;
            color: #202124 !important;
            border-bottom: 2px solid #e9ecef !important;
            text-align: left !important;
            font-size: 0.9rem !important;
          }

          .table-container .simple-table td {
            padding: 14px 16px !important;
            border-bottom: 1px solid #e9ecef !important;
            vertical-align: middle !important;
            color: #202124 !important;
            font-weight: 400 !important;
          }

          .table-container .simple-table tbody tr:first-child {
            background: #fff8e1 !important;
          }

          .table-container .simple-table tbody tr:first-child td {
            padding: 18px 16px !important;
            font-weight: 500 !important;
          }

          .table-container .simple-table tbody tr:first-child td:first-child {
            position: relative;
            padding-left: 50px !important;
          }

          .table-container .simple-table tbody tr:first-child td:first-child::before {
            content: '👉';
            position: absolute;
            left: 16px;
            font-size: 1.1rem;
          }

          .table-container .simple-table tbody tr:first-child td:first-child,  
          .table-container .simple-table tbody tr:first-child td:first-child a {
            color: #e91e63 !important;
            font-weight: 700 !important;
          }

          .table-container .simple-table tr:last-child td {
            border-bottom: none !important;
          }

          .table-container .simple-table tbody tr:hover {
            background: #f8f9fa !important;
          }

          .table-container .simple-table tbody tr:first-child:hover {
            background: #fff8e1 !important;
          }

          .table-container .simple-table td:nth-child(2) {
            color: #2e7d32 !important;
            font-weight: 700 !important;
          }

          .table-container .simple-table td:nth-child(4) {
            color: #f57c00 !important;
            font-weight: 600 !important;
          }

          .table-container .simple-table td a.tour-comparison-link,
          .table-container .simple-table-mobile .table-card-value a.tour-comparison-link {
            color: #1a73e8 !important;
            text-decoration: none !important;
            font-weight: 500 !important;
          }

          .table-container .simple-table td a.tour-comparison-link:hover {     
            color: #1557b0 !important;
          }

          .simple-table-desktop {
            display: block;
            overflow-x: auto;
          }

          .simple-table-mobile {
            display: none;
          }

          .simple-table-mobile .table-card {
            display: block;
            background: white;
            border: 1px solid #e9ecef;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          }

          .simple-table-mobile .table-card:first-child {
            background: #fff8e1 !important;
            border: 2px solid #f57c00 !important;
          }

          .simple-table-mobile .table-card-row {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            margin-bottom: 8px;
          }

          .simple-table-mobile .table-card-row:last-child {
            margin-bottom: 0;
          }

          .simple-table-mobile .table-card-label {
            font-weight: 600;
            color: #5f6368;
            font-size: 0.85rem;
            min-width: 70px;
            flex-shrink: 0;
          }

          .simple-table-mobile .table-card-value {
            color: #202124;
            font-size: 0.95rem;
            line-height: 1.3;
            flex: 1;
          }

          .simple-table-mobile .table-card:first-child .table-card-row:first-child .table-card-value {
            display: flex;
            align-items: flex-start;
            gap: 8px;
          }

          .simple-table-mobile .table-card:first-child .table-card-row:first-child .table-card-value::before {
            content: '👉';
            font-size: 1.1rem;
            flex-shrink: 0;
          }

          .simple-table-mobile .table-card:first-child .table-card-row:first-child .table-card-value,
          .simple-table-mobile .table-card:first-child .table-card-row:first-child .table-card-value a {
            color: #e91e63 !important;
            font-weight: 700 !important;
          }

          .simple-table-mobile .table-card-row:nth-child(2) .table-card-value {
            color: #2e7d32;
            font-weight: 700;
          }

          .simple-table-mobile .table-card-row:nth-child(4) .table-card-value {
            color: #f57c00;
            font-weight: 600;
          }

          .quick-answer-header + .content-paragraph {
            margin-top: 0 !important;
            padding: 0.75rem 1rem 1rem 1rem;
            background: #f8fdf8;
            border-left: 3px solid #4caf50;
            border-radius: 0 0 4px 4px;
          }

          @media (max-width: 768px) {
            .simple-table-desktop {
              display: none;
            }
            .simple-table-mobile {
              display: block;
            }

            .gallery-grid {
              grid-template-columns: 1fr;
            }

            .table-container .table-title {
              font-size: 1.2rem !important;
              font-weight: 600 !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
}






