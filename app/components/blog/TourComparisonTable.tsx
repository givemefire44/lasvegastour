interface TourComparisonTableProps {
    currentTour: any;
    relatedTours: any[];
  }
  
  export default function TourComparisonTable({ currentTour, relatedTours }: TourComparisonTableProps) {
    const getThumb = (tour: any) => {
      const url = tour?.heroGallery?.[0]?.asset?.url || tour?.mainImage?.asset?.url || tour?.seoImage?.asset?.url;
      return url ? `${url}?w=200&h=200&fit=crop&auto=format&q=85` : null;
    };
    // Combinar tour actual + relacionados (máx 4 total)
    const filteredRelated = relatedTours.slice(0, 3).filter(tour => 
      tour?.tourInfo?.price && tour?.getYourGuideData?.rating
    ).sort((a, b) => (a.tourInfo?.price || 999) - (b.tourInfo?.price || 999));
    const toursToCompare = [currentTour, ...filteredRelated].filter(Boolean);
  
    if (toursToCompare.length < 2) return null;
  
    return (
      <>
       
  
        <div style={{ margin: '40px 0' }}>
          <h3 style={{
            fontSize: '1.4rem',
            fontWeight: '700',
            marginBottom: '20px',
            color: '#202124',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            📊 Compare Similar Tours
          </h3>
          
          {/* DESKTOP: Tabla */}
          <div className="comparison-table-desktop">
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              background: 'white',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              fontSize: '0.95rem'
            }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: '600', color: '#202124', borderBottom: '2px solid #e9ecef' }}>Tour</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '600', color: '#202124', borderBottom: '2px solid #e9ecef' }}>Price</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '600', color: '#202124', borderBottom: '2px solid #e9ecef' }}>Duration</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '600', color: '#202124', borderBottom: '2px solid #e9ecef' }}>Rating</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '600', color: '#202124', borderBottom: '2px solid #e9ecef' }}>Features</th>
                </tr>
              </thead>
              <tbody>
                {toursToCompare.map((tour: any, index: number) => {
                  const isCurrentTour = tour.slug?.current === currentTour.slug?.current;
                  
                  return (
                    <tr 
                      key={tour.slug?.current || index} 
                      style={{ 
                        borderBottom: '1px solid #e9ecef',
                        background: isCurrentTour ? '#fff8e1' : 'white'
                      }}
                    >
                      <td style={{ padding: '14px 16px' }}>
                        <a 
                          href={`/tour/${tour.slug?.current}`}
                          style={{ 
                            color: isCurrentTour ? '#e91e63' : '#1a73e8', 
                            textDecoration: 'none', 
                            fontWeight: isCurrentTour ? '700' : '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                        >
                          {getThumb(tour) && (
                            <span style={{ width: '56px', height: '56px', borderRadius: '8px', flexShrink: 0, display: 'inline-block', backgroundImage: `url("${getThumb(tour)}")`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                          )}
                          {isCurrentTour && <span>👉</span>}
                          <span style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            maxWidth: '250px'
                          }}>
                            {tour.title}
                          </span>
                        </a>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '700', color: '#2e7d32' }}>
                        {tour.tourInfo?.currency === 'EUR' ? '€' : '$'}
                        {tour.tourInfo?.price}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', color: '#5f6368' }}>
                        {tour.tourInfo?.duration || '—'}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <span style={{ 
                          background: '#fff8e1', 
                          padding: '4px 10px', 
                          borderRadius: '6px', 
                          fontWeight: '600', 
                          color: '#f57c00',
                          fontSize: '0.9rem'
                        }}>
                          ⭐ {tour.getYourGuideData?.rating?.toFixed(1)}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                          {tour.tourFeatures?.skipTheLine && (
                            <span title="Skip the Line" style={{ fontSize: '1.1rem' }}>⚡</span>
                          )}
                          {tour.tourFeatures?.smallGroupAvailable && (
                            <span title="Small Group" style={{ fontSize: '1.1rem' }}>👥</span>
                          )}
                          {tour.tourFeatures?.freeCancellation && (
                            <span title="Free Cancellation" style={{ fontSize: '1.1rem' }}>✅</span>
                          )}
                          {tour.tourFeatures?.wheelchairAccessible && (
                            <span title="Wheelchair Accessible" style={{ fontSize: '1.1rem' }}>♿</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
  
          {/* MOBILE: Cards */}
          <div className="comparison-cards-mobile">
            {toursToCompare.map((tour: any, index: number) => {
              const isCurrentTour = tour.slug?.current === currentTour.slug?.current;
              
              return (
                <a 
                  key={tour.slug?.current || index}
                  href={`/tour/${tour.slug?.current}`}
                  style={{
                    display: 'block',
                    background: isCurrentTour ? '#fff8e1' : 'white',
                    border: isCurrentTour ? '2px solid #f57c00' : '1px solid #e9ecef',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '12px',
                    textDecoration: 'none',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                  }}
                >
                  {/* Tour Name */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '12px'
                  }}>
                    {getThumb(tour) && (
                      <span style={{ width: '56px', height: '56px', borderRadius: '8px', flexShrink: 0, display: 'inline-block', backgroundImage: `url("${getThumb(tour)}")`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                    )}
                    {isCurrentTour && <span style={{ fontSize: '1.1rem' }}>👉</span>}
                    <span style={{
                      color: isCurrentTour ? '#e91e63' : '#1a73e8',
                      fontWeight: isCurrentTour ? '700' : '600',
                      fontSize: '0.95rem',
                      lineHeight: '1.3'
                    }}>
                      {tour.title}
                    </span>
                  </div>
                  
                  {/* Stats Row */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    marginBottom: '10px',
                    flexWrap: 'wrap'
                  }}>
                    <span style={{
                      background: '#fff8e1',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontWeight: '600',
                      color: '#f57c00',
                      fontSize: '0.85rem'
                    }}>
                      ⭐ {tour.getYourGuideData?.rating?.toFixed(1)}
                    </span>
                    <span style={{ fontWeight: '700', color: '#2e7d32', fontSize: '0.95rem' }}>
                      {tour.tourInfo?.currency === 'EUR' ? '€' : '$'}{tour.tourInfo?.price}
                    </span>
                    <span style={{ color: '#5f6368', fontSize: '0.85rem' }}>
                      ⏱️ {tour.tourInfo?.duration || '—'}
                    </span>
                  </div>
                  
                  {/* Features Row */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {tour.tourFeatures?.skipTheLine && (
                      <span style={{ fontSize: '0.8rem', color: '#5f6368' }}>⚡ Skip Line</span>
                    )}
                    {tour.tourFeatures?.smallGroupAvailable && (
                      <span style={{ fontSize: '0.8rem', color: '#5f6368' }}>👥 Small Group</span>
                    )}
                    {tour.tourFeatures?.freeCancellation && (
                      <span style={{ fontSize: '0.8rem', color: '#5f6368' }}>✅ Free Cancel</span>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
          
          <p style={{ 
            fontSize: '0.85rem', 
            color: '#5f6368', 
            marginTop: '12px',
            textAlign: 'center'
          }}>
            💡 Prices may vary based on date and group size. Current tour highlighted.
          </p>
        </div>
  
        <style jsx>{`
          .comparison-table-desktop {
            display: block;
          }
          .comparison-cards-mobile {
            display: none;
          }
          
          @media (max-width: 768px) {
            .comparison-table-desktop {
              display: none;
            }
            .comparison-cards-mobile {
              display: block;
            }
          }
        `}</style>
      </>
    );
  }