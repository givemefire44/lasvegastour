// app/components/ResearchBadge.tsx
// Clonado de colosseumroman-blog/app/components/ResearchBadge.tsx, que es el que ya funciona.
// Solo cambian el destino del enlace y el texto. Aparece unicamente en las pages del research
// program (pilares y soportes); las del cluster editorial no lo llevan porque no tienen ni
// isPillar ni parentPillar.
'use client';

import Link from 'next/link';

interface ResearchBadgeProps {
  isPillar?: boolean;
  parentPillar?: { _ref?: string; _id?: string };
}

export default function ResearchBadge({ isPillar, parentPillar }: ResearchBadgeProps) {
  const isResearch = isPillar === true || Boolean(parentPillar?._ref);

  if (!isResearch) return null;

  return (
    <Link
      href="/las-vegas-research"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.4rem 0.85rem',
        background: '#f3e8ff',
        border: '1px solid #d8b4fe',
        borderRadius: '9999px',
        textDecoration: 'none',
        color: '#6b21a8',
        fontSize: '0.8125rem',
        fontWeight: 600,
        lineHeight: 1,
        marginTop: '1.5rem',
        marginBottom: '1rem',
        transition: 'all 0.2s ease',
      }}
    >
      <span style={{ fontSize: '0.95rem' }}>📊</span>
      <span>Part of The Las Vegas Research Program</span>
      <span style={{ fontSize: '0.95rem' }}>→</span>
    </Link>
  );
}
