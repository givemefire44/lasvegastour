"use client";
import React, { useState, useRef, useEffect } from "react";

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

export default function TourHeader() {
  // Estados para búsqueda modal (como MinimalHeader)
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null);
  
  // Estado para renderizar solo en cliente (como MinimalHeader)
  const [isClient, setIsClient] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Solo renderizar en cliente para evitar hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Buscar tours en Viator API
  const searchTours = async (query: string) => {
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
        setTours(data.results.slice(0, 8)); // Más resultados en modal
      } else {
        setTours([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setTours([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBusqueda(value);
    setHovered(null);
    
    const timeoutId = setTimeout(() => {
      searchTours(value);
    }, 300);

    return () => clearTimeout(timeoutId);
  };

  const handleTourSelect = (tour: Tour) => {
    setBusqueda(tour.name);
    setSearchModalOpen(false);
    setSelectedTour(tour);
    window.open(tour.viator_url, "_blank");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTour) {
      window.open(selectedTour.viator_url, "_blank");
    } else if (busqueda.trim()) {
      const searchUrl = `https://www.viator.com/s/?q=${encodeURIComponent(busqueda)}&pid=P00140156&mcid=42383&medium=search`;
      window.open(searchUrl, "_blank");
    }
    setSearchModalOpen(false);
  };

  // Focus automático en modal (como MinimalHeader)
  useEffect(() => {
    if (searchModalOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchModalOpen]);

  // No renderizar nada hasta que esté en el cliente
  if (!isClient) {
    return (
      <div style={{ height: '70px', width: '100%' }}>
        {/* Placeholder invisible para mantener espacio */}
      </div>
    );
  }

  return (
    <>
      {/* HEADER - LIMPIO SIN DROPDOWN */}
      <header
        style={{
          height: 70,
          background: "#fff",
          borderBottom: "1px solid #e0e0e0",
          boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
          width: "100%",
          position: "relative",
          zIndex: 1000
        }}
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 15px",
          height: "100%",
          maxWidth: "1250px",
          margin: "0 auto",
          minWidth: 0
        }}>
          {/* LOGO */}
          <div style={{ 
            fontSize: "clamp(16px, 4vw, 20px)",
            fontWeight: 700, 
            color: "#8816c0",
            cursor: "pointer",
            flexShrink: 0,
            marginRight: 10
          }}>
            lasvegastour.com
          </div>

          {/* BÚSQUEDA - SOLO BOTÓN PARA ABRIR MODAL */}
          <div style={{
            flex: 1,
            maxWidth: 400,
            margin: "0 10px",
            minWidth: 0
          }}>
            <button
              onClick={() => setSearchModalOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                background: "#f8f9fa",
                borderRadius: 25,
                border: "1px solid #e1e5e9",
                padding: "8px 12px",
                transition: "all 0.2s ease",
                minWidth: 0,
                width: "100%",
                cursor: "pointer"
              }}
            >
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="#666" 
                strokeWidth="2"
                style={{ marginRight: 8, flexShrink: 0 }}
              >
                <circle cx="11" cy="11" r="8"></circle>
                <path d="M21 21l-4.35-4.35"></path>
              </svg>
              <span style={{
                flex: 1,
                fontSize: "clamp(12px, 3vw, 14px)",
                color: "#999",
                textAlign: "left"
              }}>
                Search tours...
              </span>
            </button>
          </div>

          {/* SELECTOR DE IDIOMA */}
          <div style={{
            display: "flex",
            alignItems: "center",
            flexShrink: 0
          }}>
            <button
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                background: "transparent",
                border: "1px solid #e1e5e9",
                borderRadius: 20,
                padding: "6px 8px",
                fontSize: "clamp(12px, 3vw, 14px)",
                color: "#666",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = "#8816c0";
                e.currentTarget.style.color = "#8816c0";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = "#e1e5e9";
                e.currentTarget.style.color = "#666";
              }}
            >
              <span>🌐</span>
              <span>EN</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6,9 12,15 18,9"></polyline>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* MODAL DE BÚSQUEDA - COMO MINIMALHEADER */}
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
            maxWidth: '600px',
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
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#333' }}>
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
                      fontSize: '16px',
                      color: '#333'
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
                      <svg width="16" height="16" viewBox="0 0 20 20">
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
                      borderBottom: i < tours.length - 1 ? '1px solid #f0f0f0' : 'none',
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
                          objectFit: 'cover',
                          flexShrink: 0
                        }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '500',
                        marginBottom: '4px',
                        color: '#333',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {tour.name}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#666',
                        display: 'flex',
                        gap: '8px'
                      }}>
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