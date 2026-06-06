import Link from 'next/link';

export default function TourFinderBanner() {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      borderRadius: '12px',
      padding: '16px 24px',
      marginBottom: '32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
    }}>
      <span style={{
        color: '#fff',
        fontSize: '1rem',
        fontWeight: 600,
      }}>
        Not sure which tour? Get a personalized match in 30 seconds
      </span>
      <Link
        href="/tour-finder"
        style={{
          background: '#e91e63',
          color: '#fff',
          padding: '10px 22px',
          borderRadius: '8px',
          fontWeight: 700,
          fontSize: '0.9rem',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        Find My Tour →
      </Link>
    </div>
  );
}