import Link from 'next/link';
import Image from 'next/image';
import { urlFor } from '@/sanity/lib/image';

interface RelatedToursProps {
  tours: Array<{
    _id: string;
    title: string;
    slug: { current: string };
    mainImage?: {
      asset: { url: string };
      alt?: string;
    };
    heroGallery?: Array<{
      asset: { url: string };
      alt?: string;
    }>;
    body: any;
  }>;
}

// Función para extraer texto plano del body de Sanity
function extractDescription(body: any): string {
  if (!body || !Array.isArray(body)) return '';
  
  for (const block of body) {
    if (block._type === 'block' && block.children) {
      const text = block.children
        .filter((child: any) => child._type === 'span')
        .map((child: any) => child.text)
        .join('');
      
      if (text.trim()) {
        return text.length > 120 ? text.substring(0, 120) + '...' : text;
      }
    }
  }
  
  return 'Descubrí este increíble tour por Roma...';
}

// 🎯 FUNCIÓN MEJORADA - Selección inteligente de imágenes
function getBestImage(tour: RelatedToursProps['tours'][0]) {
  const allImages = [];
  
  // 1. Agregar mainImage si existe (suele ser la más curada)
  if (tour.mainImage?.asset?.url) {
    allImages.push({
      ...tour.mainImage,
      source: 'mainImage',
      priority: 10 // Alta prioridad para mainImage
    });
  }
  
  // 2. Agregar todas las imágenes de heroGallery
  if (tour.heroGallery && tour.heroGallery.length > 0) {
    tour.heroGallery.forEach((img, index) => {
      if (img?.asset?.url) {
        allImages.push({
          ...img,
          source: 'heroGallery',
          priority: index === 0 ? 8 : 5 - index // Primera imagen alta prioridad, resto menos
        });
      }
    });
  }
  
  if (allImages.length === 0) return null;
  
  // 3. Filtrar imágenes con nombres/alt problemáticos
  const filteredImages = allImages.filter(img => {
    const alt = (img.alt || '').toLowerCase();
    const url = img.asset.url.toLowerCase();
    
    // 🚫 Filtrar imágenes que probablemente sean malas
    const badKeywords = [
      'placeholder', 'test', 'draft', 'temp', 'backup',
      'unnamed', 'untitled', 'copy', 'duplicate',
      'low', 'bad', 'blurry', 'small'
    ];
    
    const hasBadKeyword = badKeywords.some(keyword => 
      alt.includes(keyword) || url.includes(keyword)
    );
    
    return !hasBadKeyword;
  });
  
  // 4. Si hay imágenes filtradas, usar esas; sino, usar todas
  const candidateImages = filteredImages.length > 0 ? filteredImages : allImages;
  
  // 5. Ordenar por prioridad y seleccionar la mejor
  const bestImage = candidateImages.sort((a, b) => b.priority - a.priority)[0];
  
  return bestImage;
}

// 🎯 ALTERNATIVA: Selección por índice específico
function getBestImageByIndex(tour: RelatedToursProps['tours'][0], preferredIndex = 1) {
  // Intentar índice específico primero (por defecto índice 1, no 0)
  if (tour.heroGallery?.[preferredIndex]?.asset?.url) {
    return tour.heroGallery[preferredIndex];
  }
  
  // Fallback a mainImage
  if (tour.mainImage?.asset?.url) {
    return tour.mainImage;
  }
  
  // Último fallback: cualquier imagen disponible
  if (tour.heroGallery?.[0]?.asset?.url) {
    return tour.heroGallery[0];
  }
  
  return null;
}

// 🎯 PRIMERA IMAGEN DEL HERO (mejor tamaño/calidad)
function getBestImageFromHero(tour: RelatedToursProps['tours'][0]) {
  // Siempre usar la primera imagen del heroGallery (mejor tamaño)
  if (tour.heroGallery?.[0]?.asset?.url) {
    return tour.heroGallery[0];
  }
  
  // Fallback a mainImage si no hay heroGallery
  if (tour.mainImage?.asset?.url) {
    return tour.mainImage;
  }
  
  return null;
}

export default function RelatedTours({ tours }: RelatedToursProps) {
  if (!tours || tours.length === 0) {
    return null;
  }

  return (
    <section className="related-tours">
      <div className="related-tours-container">
        <h2 className="related-tours-title">You may also be interested in</h2>
        
        <div className="tours-grid">
          {tours.slice(0, 2).map((tour, tourIndex) => {
            // 🏆 Primera imagen del hero (mejor tamaño)
            const image = getBestImageFromHero(tour);
            
            const description = extractDescription(tour.body);
            
            return (
              <div key={tour._id} className="tour-item">
                <Link href={`/tour/${tour.slug.current}`} className="tour-link">
                  
                  {/* IMAGEN - 🚀 ULTRA OPTIMIZADA */}
                  <div className="tour-image">
                    {image ? (
                      <Image
                        src={urlFor(image)
                          .width(500)
                          .height(250)
                          .format('webp')
                          .quality(90) // Mayor calidad para imágenes más pequeñas
                          .fit('crop')
                          .url()}
                        alt={image.alt || tour.title}
                        fill
                        style={{ objectFit: 'cover' }}
                        sizes="(max-width: 768px) 100vw, 50vw"
                        loading="lazy"
                        placeholder="blur"
                        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                      />
                    ) : (
                      <div className="tour-placeholder">
                        🏛️ {tour.title}
                      </div>
                    )}
                  </div>

                  {/* CONTENIDO */}
                  <div className="tour-content">
                    
                    {/* TÍTULO */}
                    <h3 className="tour-card-title">{tour.title}</h3>

                    {/* DESCRIPCIÓN EXTRAÍDA DEL BODY */}
                    <p className="tour-description">
                      {description}
                    </p>

                    {/* BOTÓN READ MORE - Ya linkeable por estar dentro del Link */}
                    <div className="tour-actions">
                      <button className="read-more-button">
                        Read More
                      </button>
                    </div>

                  </div>
                </Link>
              </div>
            );
          })}
        </div>

        {/* BOTÓN VER MÁS - LINKEABLE */}
        <div className="tours-footer">
          <Link href="/tours/colosseum" className="view-all-button">
            See All Colosseum Tours
          </Link>
        </div>
      </div>

      {/* ESTILOS INTEGRADOS */}
      <style jsx>{`
        .related-tours {
          margin: 60px 0 40px 0;
        }

        .related-tours-container {
          max-width: 100%;
        }

        .related-tours-title {
          font-size: 1.4rem;
          font-weight: 700;
          color: #202124;
          margin: 0 0 30px 0;
          padding-bottom: 15px;
          border-bottom: 2px solid #f1f3f4;
        }

        .tours-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          margin-bottom: 40px;
        }

        .tour-item {
          display: block;
        }

        .tour-link {
          display: block;
          text-decoration: none;
          color: inherit;
          transition: transform 0.2s ease;
        }

        .tour-link:hover {
          transform: translateY(-2px);
        }

        .tour-image {
          position: relative;
          width: 100%;
          height: 200px;
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 15px;
        }

        .tour-placeholder {
          width: 100%;
          height: 100%;
          background: #f1f3f4;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #5f6368;
          font-size: 14px;
        }

        .tour-content {
          padding: 0;
        }

        .tour-card-title {
          font-size: 1.1rem;
          font-weight: 600;
          color: #202124;
          margin: 0 0 8px 0;
          line-height: 1.3;
        }

        .tour-description {
          font-size: 14px;
          color: #5f6368;
          line-height: 1.4;
          margin: 0 0 15px 0;
        }

        .tour-actions {
          margin-top: 15px;
        }

        .read-more-button {
          background: #e91e63;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .read-more-button:hover {
          background: #c2185b;
        }

        .tours-footer {
          text-align: center;
          margin-top: 40px;
          padding-top: 25px;
          border-top: 1px solid #f1f3f4;
        }

        .view-all-button {
          display: inline-block;
          background: transparent;
          color: #e91e63;
          border: 2px solid #e91e63;
          padding: 12px 24px;
          border-radius: 25px;
          text-decoration: none;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.2s ease;
        }

        .view-all-button:hover {
          background: #e91e63;
          color: white;
        }

        /* RESPONSIVE */
        @media (max-width: 768px) {
          .tours-grid {
            grid-template-columns: 1fr;
            gap: 25px;
          }
          
          .tour-image {
            height: 180px;
          }
          
          .related-tours-title {
            font-size: 1.2rem;
          }
        }
      `}</style>
    </section>
  );
}