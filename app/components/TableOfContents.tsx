'use client';

import { useState, useMemo } from 'react';

interface Heading {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  content: any[];
}

export default function TableOfContents({ content }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('');

  // Procesar headings sincrónicamente
  const headings = useMemo(() => {
    return content
      .filter((block: any) => block.style === 'h2') 
      .map((block: any) => {
        // Concatenar TODOS los children
        const text = block.children
          .map((child: any) => child.text || '')
          .join('')
          .trim();
        
        const id = text
          .replace(/[^\w\s-]/g, '')
          .toLowerCase()
          .trim()
          .replace(/\s+/g, '-')
          .replace(/(^-|-$)/g, '');
        
        return {
          id,
          text,
          level: block.style === 'h2' ? 2 : 3
        };
      })
      .filter((heading) => heading.id.length > 0); // Quita los vacíos
  }, [content]);

  const handleClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
      
      setActiveId(id);
    }
  };

  // Solo mostrar si hay 3+ headings
  if (headings.length < 3) {
    return null;
  }

  return (
    <nav style={{
      marginBottom: '2rem',
      marginTop: '1rem'
    }}>
      <h3 style={{
        fontSize: '0.95rem',
        fontWeight: '600',
        marginBottom: '12px',
        color: '#374151',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        📋 Table of Contents
      </h3>
      
      <ul style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '2px'
      }}>
        {headings.map((heading, index) => (
          <li key={index}>
            <button
              onClick={() => handleClick(heading.id)}
              style={{
                width: '100%',
                textAlign: 'left',
                background: activeId === heading.id ? '#f3f4f6' : 'transparent',
                border: 'none',
                padding: '8px 12px',
                paddingLeft: heading.level === 3 ? '28px' : '12px',
                cursor: 'pointer',
                color: activeId === heading.id ? '#1f2937' : '#6b7280',
                fontWeight: activeId === heading.id ? '500' : '400',
                fontSize: '0.875rem',
                borderRadius: '4px',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                lineHeight: '1.4'
              }}
              onMouseEnter={(e) => {
                if (activeId !== heading.id) {
                  e.currentTarget.style.background = '#f9fafb';
                }
              }}
              onMouseLeave={(e) => {
                if (activeId !== heading.id) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <span style={{ opacity: 0.4, fontSize: '0.7rem' }}>
                {heading.level === 2 ? '▸' : '◦'}
              </span>
              <span style={{ flex: 1 }}>{heading.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}