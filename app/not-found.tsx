import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{ 
      textAlign: 'center', 
      padding: '4rem 2rem',
      minHeight: '50vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center'
    }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
        Page Not Found
      </h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        The page you're looking for doesn't exist.
      </p>
      <Link 
        href="/"
        style={{
          display: 'inline-block',
          background: '#e91e63',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '25px',
          textDecoration: 'none',
          fontWeight: '600'
        }}
      >
        Go to Homepage
      </Link>
    </div>
  )
}