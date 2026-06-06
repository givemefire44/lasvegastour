// app/components/TourFinderButton.tsx
import Link from 'next/link';

export default function TourFinderButton() {
  return (
    <Link
      href="/tour-finder"
      style={{
        display: 'block',
        padding: '10px 20px',
        background: 'linear-gradient(135deg, #e91e63, #e91e63)',
        borderRadius: '32px',
        textDecoration: 'none',
        textAlign: 'center',
        marginTop: '16px',
        boxShadow: '0 4px 12px rgba(233,30,99,0.25)',
      }}
    >
      <span style={{
        color: '#fff',
        fontWeight: 700,
        fontSize: '0.95rem',
      }}>
         Find My Tour →
      </span>
      <span style={{
        display: 'block',
        color: 'rgb(255, 255, 255)',
        fontWeight: 600,
        fontSize: '0.80rem',
        marginTop: '2px',
      }}>
        Answer 4 questions. Get your ideal tour.
      </span>
    </Link>
  );
}