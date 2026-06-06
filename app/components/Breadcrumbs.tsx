'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface BreadcrumbItem {
  label: string
  href?: string
  isActive?: boolean
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  className?: string
  noSchema?: boolean  // 🆕 Para evitar schema duplicado en mobile
}

export default function Breadcrumbs({ items, className = '', noSchema = false }: BreadcrumbsProps) {
  const pathname = usePathname()
  
  return (
    <nav 
      aria-label="Breadcrumb" 
      className={className}
      style={{
        margin: '0.8rem 0 1.5rem 0',
        fontSize: '0.9rem'
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        color: '#22c55e',
        fontWeight: '500'
      }}>
        {/* Icono de navegación */}
        <span style={{ fontSize: '1rem' }}>🧭</span>
        
        <ol style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          listStyle: 'none',
          margin: 0,
          padding: 0
        }}>
          {items.map((item, index) => (
            <li key={index} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              {/* Separador */}
              {index > 0 && (
                <span style={{
                  color: '#22c55e',
                  fontSize: '0.8rem',
                  opacity: 0.7
                }}>
                  →
                </span>
              )}
              
              {/* Link o texto activo */}
              {item.href && !item.isActive ? (
                <Link 
                  href={item.href}
                  className="breadcrumb-link"
                  style={{
                    color: '#22c55e',
                    textDecoration: 'none',
                    opacity: 0.8,
                    transition: 'opacity 0.2s ease'
                  }}
                >
                  {item.label}
                </Link>
              ) : (
                <span style={{
                  color: '#22c55e',
                  fontWeight: item.isActive ? '600' : '500',
                  opacity: item.isActive ? 1 : 0.8
                }}>
                  {item.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
      
      {/* Structured Data para SEO - Solo si noSchema es false */}
      {!noSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              "itemListElement": items.map((item, index) => {
                // Determinar la URL del item
                // Si tiene href, usarlo; si es activo sin href, usar pathname actual
                const itemUrl = item.href 
                  ? `https://lasvegastour.com${item.href}`
                  : item.isActive 
                    ? `https://lasvegastour.com${pathname}`
                    : undefined;
                
                return {
                  "@type": "ListItem",
                  "position": index + 1,
                  "name": item.label,
                  ...(itemUrl && { "item": itemUrl })
                };
              })
            })
          }}
        />
      )}
      
      {/* CSS para hover */}
      <style jsx>{`
        .breadcrumb-link:hover {
          opacity: 1 !important;
        }
      `}</style>
    </nav>
  )
}