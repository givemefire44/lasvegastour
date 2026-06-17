'use client';
import Link from 'next/link';
import hubData from '@/data/tourHubs.json';

interface HubChipsProps {
  activeSlug?: string;
  tourTitle?: string;
  tourFeatures?: {
    skipTheLine?: boolean;
    smallGroupAvailable?: boolean;
    freeCancellation?: boolean;
  };
}

const hubs = hubData.hubs;

function getMatchingHubs(title?: string, features?: HubChipsProps['tourFeatures']) {
  if (!title && !features) return hubs;
  
  const titleLower = (title || '').toLowerCase();
  
  return hubs.filter((hub: any) => {
    // Check keyword match in title
    const keywordMatch = hub.matchKeywords?.some((kw: string) => 
      titleLower.includes(kw.toLowerCase())
    );
    
    // Check feature match
    const featureMatch = Object.entries(hub.matchFeatures || {}).some(
      ([key, val]) => features?.[key as keyof typeof features] === val
    );
    
    return keywordMatch || featureMatch;
  });
}

export default function HubChips({ activeSlug, tourTitle, tourFeatures }: HubChipsProps) {
  const contextual = !!(tourTitle || tourFeatures);
  const displayHubs = contextual ? getMatchingHubs(tourTitle, tourFeatures) : hubs;
  
  if (contextual && displayHubs.length === 0) return null;

  return (
    <div style={{ padding: '30px 0' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '20px', color: '#333' }}>
      {contextual ? '🏷️ This tour appears in' : '🗺️ Browse Las Vegas Tours'}
      </h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        {displayHubs.map((h: any) => (
          <Link key={h.slug} href={`/${h.slug}`} style={{
            padding: '8px 16px',
            backgroundColor: h.slug === activeSlug ? '#e91e63' : '#f5f5f5',
            color: h.slug === activeSlug ? '#fff' : '#333',
            borderRadius: '20px', fontSize: '0.9rem', fontWeight: '500',
            textDecoration: 'none', border: '1px solid #e9ecef'
          }}>{h.icon} {h.shortTitle}</Link>
        ))}
      </div>
    </div>
  );
}