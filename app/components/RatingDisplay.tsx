'use client';

import { useId } from 'react';

interface RatingDisplayProps {
  rating: number;
  reviewCount: number;
  size?: 'small' | 'medium' | 'large';
  showReviewCount?: boolean;
  sourceUrl?: string;
  className?: string;
}

export default function RatingDisplay({
  rating,
  reviewCount,
  size = 'medium',
  showReviewCount = true,
  sourceUrl,
  className = ''
}: RatingDisplayProps) {
  // ID estable: igual en el servidor y en el navegador (evita el hydration mismatch)
  const baseId = useId().replace(/:/g, '');

  const StarIcon = ({ fillPercentage, id }: { fillPercentage: number; id: string }) => {
    return (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset={`${fillPercentage}%`} style={{ stopColor: '#FBBF24', stopOpacity: 1 }} />
            <stop offset={`${fillPercentage}%`} style={{ stopColor: '#E5E7EB', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
        <path
          d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
          fill={`url(#${id})`}
        />
      </svg>
    );
  };

  const renderStars = () => {
    return [...Array(5)].map((_, i) => {
      let fillPercentage = 0;

      if (i < Math.floor(rating)) {
        fillPercentage = 100;
      } else if (i === Math.floor(rating)) {
        fillPercentage = (rating % 1) * 100;
      } else {
        fillPercentage = 0;
      }

      return (
        <StarIcon
          key={i}
          fillPercentage={fillPercentage}
          id={`${baseId}-star-${i}`}
        />
      );
    });
  };

  const content = (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '12px',
        backgroundColor: 'white',
        padding: '10px 16px',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        whiteSpace: 'nowrap'
      }}
    >
      {/* Estrellas */}
      <div style={{ display: 'flex', gap: '2px' }}>
        {renderStars()}
      </div>

      {/* Rating numérico */}
      <span style={{
        fontSize: '18px',
        fontWeight: '700',
        color: '#111827'
      }}>
        {rating.toFixed(1)}
      </span>

      {/* Reviews count */}
      {showReviewCount && (
        <span style={{
          fontSize: '15px',
          color: '#6b7280'
        }}>
          ({reviewCount.toLocaleString()} reviews)
        </span>
      )}
    </div>
  );

  if (sourceUrl) {
    return (
      
     <a   href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          textDecoration: 'none',
          display: 'inline-block'
        }}
      >
        {content}
      </a>
    );
  }

  return content;
}