// app/components/AuthorBox.tsx
'use client';
interface AuthorLinks {
  profile: string;
  linkedin: string | null;
  blog: string | null;
}
interface AuthorInfo {
  name: string;
  role: string;
  bio: string;
  links: AuthorLinks;
  sameAs?: string[]; // ← NUEVO: Para schema
}
interface AuthorBoxProps {
  author: 'mario-dalo' | 'curator-team' | 'none' | string | undefined;
  variant?: 'byline' | 'full';
  publishedAt?: string;
}
const AUTHORS: Record<string, AuthorInfo> = {
  'mario-dalo': {
    name: 'Mario Dalo',
    role: 'Founder of Intercoper',
    bio: "I've spent years building independent travel guides through Intercoper. I created LasVegasTour to help travelers find the best tours, shows, and day trips in Las Vegas - reviewed and compared, not just the tourist surface.",
    links: {
      profile: '/about-us',
      linkedin: 'https://www.linkedin.com/in/mariodalo/',
      blog: 'https://mariodalo.com'
    },
    sameAs: [
      'https://www.linkedin.com/in/mariodalo/',
      'https://mariodalo.com',
      'https://featured.com/p/mario-dalo-8288',
      'https://intercoper.com/author/mario-dalo',
      'https://www.reddit.com/user/Mario_Dalo/'
    ]
  
  },
  'curator-team': {
    name: 'Intercoper Curator Team',
    role: 'Travel Specialists',
    bio: 'Our team of travel specialists researches and curates the best tour experiences. We combine local expertise with rigorous verification to recommend only tours worth your time.',
    links: {
      profile: '/about-us',
      linkedin: null,
      blog: null
    },
    sameAs: []
  }
};
export default function AuthorBox({ author, variant = 'full', publishedAt }: AuthorBoxProps) {
  if (!author || author === 'none') {
    return null;
  }
  const authorData = AUTHORS[author];
  if (!authorData) {
    return null;
  }
  const formattedDate = publishedAt 
    ? new Date(publishedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;
  // ========================================
  // GENERAR SCHEMA.ORG
  // ========================================
  const generateAuthorSchema = () => {
    if (author === 'mario-dalo') {
      return {
        "@context": "https://schema.org",
        "@type": "Person",
        "@id": "https://intercoper.com/author/mario-dalo#person",
        "name": authorData.name,
        "url": `https://lasvegastour.com${authorData.links.profile}`,
        "jobTitle": authorData.role,
        "description": authorData.bio,
        "image": "https://lasvegastour.com/images/mario-dalo.webp",
        ...(authorData.sameAs && authorData.sameAs.length > 0 && { 
          "sameAs": authorData.sameAs 
        })
      };
    } else if (author === 'curator-team') {
      return {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": authorData.name,
        "url": `https://lasvegastour.com${authorData.links.profile}`,
        "description": authorData.bio
      };
    }
    return null;
  };
  const authorSchema = generateAuthorSchema();
  if (variant === 'byline') {
    return (
      <>
        {/* Schema solo en variante full, no en byline (evitar duplicación) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            {author === 'mario-dalo' ? (
              <img 
                src="/images/mario-dalo.webp" 
                alt="Mario Dalo" 
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover', 
                  borderRadius: '50%' 
                }} 
              />
            ) : (
              <img
  src="/images/intercoper-team.webp"
  alt="Intercoper Curator Team"
  style={{
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '50%'
  }}
/>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.95rem', color: '#6b7280' }}>By</span>
              <a 
                href={authorData.links.profile}
                rel="author"
                style={{ fontWeight: '600', color: '#1a1a1a', textDecoration: 'none' }}
              >
                {authorData.name}
              </a>
              {formattedDate && (
                <>
                  <span style={{ color: '#d1d5db' }}>•</span>
                  <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>{formattedDate}</span>
                </>
              )}
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: '#9ca3af' }}>
              {authorData.role}
            </p>
          </div>
        </div>
      </>
    );
  }
  return (
    <>
      {/* Schema JSON-LD - Solo en variante full */}
      {authorSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(authorSchema, null, 2)
          }}
        />
      )}
      <div style={{
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '16px',
        padding: '24px',
        marginTop: '3rem',
        marginBottom: '2rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', marginBottom: '16px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            {author === 'mario-dalo' ? (
              <img 
                src="/images/mario-dalo.webp" 
                alt="Mario Dalo" 
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover', 
                  borderRadius: '50%' 
                }} 
              />
            ) : (
              <img
  src="/images/intercoper-team.webp"
  alt="Intercoper Curator Team"
  style={{
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '50%'
  }}
/>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ 
              margin: '0 0 4px 0', 
              fontSize: '0.85rem', 
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: '600'
            }}>
              About the Author
            </p>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: '700', color: '#1a1a1a' }}>
              {authorData.name}
            </h3>
            <p style={{ margin: 0, fontSize: '0.95rem', color: '#8b5cf6', fontWeight: '500' }}>
              {authorData.role}
            </p>
          </div>
        </div>
        <p style={{ margin: '0 0 20px 0', color: '#4b5563', lineHeight: '1.7', fontSize: '0.95rem' }}>
          {authorData.bio}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <a 
            href={authorData.links.profile} 
            rel="author" 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '8px 16px', 
              background: '#8b5cf6', 
              color: 'white', 
              borderRadius: '20px', 
              textDecoration: 'none', 
              fontSize: '0.9rem', 
              fontWeight: '500' 
            }}
          >
            👤 About 
          </a>
          {authorData.links.linkedin && (
            <a 
              href={authorData.links.linkedin} 
              target="_blank" 
              rel="me noopener noreferrer" 
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '6px', 
                padding: '8px 16px', 
                background: '#0077b5', 
                color: 'white', 
                borderRadius: '20px', 
                textDecoration: 'none', 
                fontSize: '0.9rem', 
                fontWeight: '500' 
              }}
            >
              🔗 LinkedIn
            </a>
          )}
          {authorData.links.blog && (
            <a 
              href={authorData.links.blog} 
              target="_blank" 
              rel="me author noopener noreferrer" 
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '6px', 
                padding: '8px 16px', 
                background: 'white', 
                color: '#374151', 
                borderRadius: '20px', 
                textDecoration: 'none', 
                fontSize: '0.9rem', 
                fontWeight: '500', 
                border: '1px solid #d1d5db' 
              }}
            >
              📝 Personal Blog
            </a>
          )}
        </div>
      </div>
    </>
  );
}
