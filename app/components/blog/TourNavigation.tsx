'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

interface Tour {
  id: string;
  name: string;
  slug: string;
  description: string;
  duration: string;
  price: number;
  currency: string;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  viator_url: string;
  flags: string[];
}

interface TourNavigationProps {
  tourTitle?: string;
}

export default function TourNavigation({ tourTitle }: TourNavigationProps) {
  const [activeSection, setActiveSection] = useState('description');
  
  // Estados del buscador - COMO MINIMALHEADER
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ✅ SCROLL SUAVE
  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      requestAnimationFrame(() => {
        const headerOffset = 120;
        const elementPosition = element.offsetTop;
        const offsetPosition = elementPosition - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
        
        setActiveSection(sectionId);
      });
    }
  }, []);

  // ✅ SHARE OPTIMIZADO
  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: tourTitle || 'Tour en Roma',
          url: window.location.href
        });
      } catch (err) {
        await navigator.clipboard.writeText(window.location.href);
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
    }
  }, [tourTitle]);

  // ✅ BUSCAR TOURS - COMO MINIMALHEADER
  const searchTours = useCallback(async (query: string) => {
    if (query.length < 3) {
      setTours([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/viator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchQuery: query })
      });

      const data = await response.json();
      
      if (data.success) {
        setTours(data.results.slice(0, 6));
      } else {
        setTours([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setTours([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ INPUT CHANGE - COMO MINIMALHEADER
  const handleSearchInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBusqueda(value);
    setHovered(null);
    
    const timeoutId = setTimeout(() => {
      searchTours(value);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTours]);

  // ✅ SELECT TOUR - COMO MINIMALHEADER
  const handleTourSelect = useCallback((tour: Tour) => {
    setBusqueda(tour.name);
    setSearchModalOpen(false);
    window.open(tour.viator_url, "_blank");
  }, []);

  // ✅ KEYBOARD NAVIGATION - COMO MINIMALHEADER
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!tours.length) return;
    if (e.key === "ArrowDown")
      setHovered(h => h === null ? 0 : Math.min(tours.length - 1, h! + 1));
    if (e.key === "ArrowUp")
      setHovered(h => h === null ? tours.length - 1 : Math.max(0, h! - 1));
    if (e.key === "Enter" && hovered !== null) {
      handleTourSelect(tours[hovered]);
    }
    if (e.key === "Escape") {
      setSearchModalOpen(false);
      setHovered(null);
    }
  }, [tours, hovered, handleTourSelect]);

  // ✅ HANDLE SEARCH - COMO MINIMALHEADER
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (busqueda.trim()) {
      const searchUrl = `https://www.viator.com/s/?q=${encodeURIComponent(busqueda)}&pid=P00140156&mcid=42383&medium=search`;
      window.open(searchUrl, "_blank");
    }
    setSearchModalOpen(false);
  }, [busqueda]);

  // ✅ FOCUS AUTOMÁTICO - COMO MINIMALHEADER
  useEffect(() => {
    if (searchModalOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchModalOpen]);

  // ✅ NAV ITEMS
  const navItems = useMemo(() => [
    { id: 'description', label: 'Description' },
    { id: 'details', label: 'Details' },
    { id: 'cancellations', label: 'Cancelations' },
    { id: 'book-now', label: 'Book Now', isButton: true }
  ], []);

  return (
    <>
      <div className="tour-navigation" style={{ overflowX: 'hidden', width: '100%' }}>
        <div className="tour-nav-container">
          
          <nav className="tour-nav-links">
            {navItems.slice(0, 3).map((item) => (
              <button
                key={item.id}
                className={`tour-nav-item ${activeSection === item.id ? 'active' : ''}`}
                onClick={() => scrollToSection(item.id)}
              >
                {item.label}
              </button>
            ))}
            
            {/* BUSCADOR - BOTÓN PARA ABRIR MODAL */}
            <div style={{ position: "relative", marginLeft: "40px" }}>
              <button
                onClick={() => setSearchModalOpen(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "#fff9c4",
                  borderRadius: "25px",
                  border: "0px solid #000",
                  padding: "8px 16px",
                  width: "100%",
                  maxWidth: "300px",
                  height: "34px",
                  transition: "all 0.2s ease",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                  boxSizing: "border-box"
                }}
              >
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="#000"
                  strokeWidth="2"
                  style={{ marginRight: 8, flexShrink: 0 }}
                >
                  <circle cx="11" cy="11" r="8"/>
                  <path d="M21 21l-4.35-4.35"/>
                </svg>
                <span style={{
                  flex: 1,
                  fontSize: "14px",
                  color: "#666",
                  textAlign: "left"
                }}>
                  Find Tours...
                </span>
              </button>
            </div>
          </nav>

          <button 
            className="tour-share-button"
            onClick={handleShare}
            title="Compartir tour"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            <span className="share-text">Share this Tour</span>
          </button>

        </div>
      </div>

      {/* MODAL DE BÚSQUEDA - EXACTO COMO MINIMALHEADER */}
      {searchModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingTop: '100px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '70vh',
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            {/* Header del modal */}
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                Search Tours
              </h3>
              <button
                onClick={() => setSearchModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Input de búsqueda */}
            <div style={{ padding: '20px' }}>
              <form onSubmit={handleSearch}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#f8f9fa',
                  borderRadius: '12px',
                  border: '1px solid #e1e5e9',
                  padding: '12px 16px'
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" style={{ marginRight: '12px' }}>
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="M21 21l-4.35-4.35"></path>
                  </svg>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search tours..."
                    value={busqueda}
                    onChange={handleSearchInput}
                    onKeyDown={handleKeyDown}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      outline: 'none',
                      flex: 1,
                      fontSize: '16px'
                    }}
                  />
                  {busqueda && (
                    <button
                      type="button"
                      onClick={() => {
                        setBusqueda("");
                        setTours([]);
                        searchInputRef.current?.focus();
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "2px",
                        display: "flex",
                        alignItems: "center",
                        marginLeft: 4
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 20 20">
                        <line x1="5" y1="5" x2="15" y2="15" stroke="#666" strokeWidth="2"/>
                        <line x1="15" y1="5" x2="5" y2="15" stroke="#666" strokeWidth="2"/>
                      </svg>
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Resultados */}
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {loading && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                  🔄 Searching...
                </div>
              )}
              
              {!loading && tours.length === 0 && busqueda.length >= 3 && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                  🔍 No tours found
                </div>
              )}
              
              {!loading && tours.map((tour, i) => {
                const isActive = hovered === i;
                return (
                  <div
                    key={tour.id}
                    onClick={() => handleTourSelect(tour)}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      padding: '16px 20px',
                      cursor: 'pointer',
                      backgroundColor: isActive ? '#f8f9fa' : 'transparent',
                      borderBottom: '1px solid #f0f0f0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >
                    {tour.imageUrl && (
                      <img 
                        src={tour.imageUrl} 
                        alt={tour.name}
                        style={{
                          width: '50px',
                          height: '50px',
                          borderRadius: '8px',
                          objectFit: 'cover'
                        }}
                      />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px', color: '#333' }}>
                        {tour.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666', display: 'flex', gap: '8px' }}>
                        <span style={{ color: '#e91e63', fontWeight: '600' }}>
                          ${tour.price} {tour.currency}
                        </span>
                        <span>{tour.duration}</span>
                        {tour.rating > 0 && (
                          <span>⭐ {tour.rating.toFixed(1)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}