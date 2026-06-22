"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image"; // 🆕 AGREGADO

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

export default function CitySearch() {
  const [busqueda, setBusqueda] = useState("");
  const [show, setShow] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null);
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
        setTours(data.results.slice(0, 8)); // Máximo 8 resultados en dropdown
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBusqueda(value);
    setShow(true);
    setHovered(null);
    
    // Debounce search
    const timeoutId = setTimeout(() => {
      searchTours(value);
    }, 300);

    return () => clearTimeout(timeoutId);
  };

  const handleSelect = (tour: Tour) => {
    setBusqueda(tour.name);
    setShow(false);
    setHovered(null);
    setSelectedTour(tour);
    inputRef.current?.blur();
    window.open(tour.viator_url, "_blank");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!show || tours.length === 0) return;
    if (e.key === "ArrowDown")
      setHovered(h => h === null ? 0 : Math.min(tours.length - 1, h! + 1));
    if (e.key === "ArrowUp")
      setHovered(h => h === null ? tours.length - 1 : Math.max(0, h! - 1));
    if (e.key === "Enter" && hovered !== null) {
      handleSelect(tours[hovered]);
    }
    if (e.key === "Escape") {
      setShow(false);
      setHovered(null);
    }
  };

  const handleSearch = () => {
    if (selectedTour) {
      // Abrir tour específico
      window.open(selectedTour.viator_url, "_blank");
    } else if (busqueda.trim()) {
      // Búsqueda general en Viator
      const searchUrl = `https://www.viator.com/s/?q=${encodeURIComponent(busqueda)}&pid=P00140156&mcid=42383&medium=search`;
      window.open(searchUrl, "_blank");
    }
  };

  return (
    <form
      className="search-bar-wrap"
      autoComplete="off"
      onSubmit={e => { e.preventDefault(); handleSearch(); }}
    >
      <div className="search-bar vedette">
        <span className="search-icon">
          <svg width={22} height={22} fill="none" stroke="#6c6c6c" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </span>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search tours & activities... (e.g. Sphere, Grand Canyon, Strip)"
          value={busqueda}
          onChange={handleInputChange}
          onFocus={() => { if (busqueda && tours.length > 0) setShow(true); }}
          onBlur={() => setTimeout(() => setShow(false), 150)}
          onKeyDown={handleKeyDown}
          className="search-input"
        />
        {busqueda && (
          <button
            type="button"
            className="clear-btn"
            aria-label="Clear"
            onClick={() => {
              setBusqueda("");
              setShow(false);
              setHovered(null);
              setTours([]);
              inputRef.current?.focus();
            }}
          >
            <svg width={18} height={18} viewBox="0 0 20 20">
              <line x1="5" y1="5" x2="15" y2="15" stroke="#444" strokeWidth="2"/>
              <line x1="15" y1="5" x2="5" y2="15" stroke="#444" strokeWidth="2"/>
            </svg>
          </button>
        )}
        <button
          className="vamos-btn maize"
          type="submit"
          disabled={!busqueda.trim()}
        >
          <span className="buscar-text">Search Tours!</span>
          <span className="buscar-arrow" aria-hidden="true">
            <svg width="25" height="25" viewBox="0 0 25 25" fill="none" stroke="#18120b" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12.5" x2="19" y2="12.5"/>
              <polyline points="12.5,6 19,12.5 12.5,19"/>
            </svg>
          </span>
        </button>
      </div>
      
      {/* DROPDOWN CON IMÁGENES ULTRA-OPTIMIZADAS */}
      {show && tours.length > 0 && (
        <div style={{
          position: "absolute",
          left: "15px",
          top: "110%",
          width: "calc(100% - 30px)",
          background: "white",
          border: "1px solid #e0e0e0",
          borderRadius: "15px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
          padding: "8px 0",
          maxHeight: "335px",
          overflowY: "auto",
          zIndex: 30,
          marginTop: "7px"
        }}>
          {loading && (
            <div style={{
              padding: "16px",
              textAlign: "center",
              color: "#666"
            }}>
              🔄 Searching tours...
            </div>
          )}
          
          {!loading && tours.map((tour, i) => {
            const isActive = hovered === i;
            return (
              <div
                key={tour.id}
                onClick={() => handleSelect(tour)}
                onMouseEnter={() => setHovered(i)}
                style={{
                  padding: "12px 16px",
                  cursor: "pointer",
                  backgroundColor: isActive ? "#f8f9fa" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  borderBottom: i < tours.length - 1 ? "1px solid #f0f0f0" : "none",
                  margin: "0 9px"
                }}
              >
                {/* 🚀 IMAGEN CON FALLBACK PARA DOMINIOS EXTERNOS */}
                {tour.imageUrl && (
                  <div style={{
                    position: "relative",
                    width: "50px",
                    height: "50px",
                    borderRadius: "8px",
                    overflow: "hidden",
                    flexShrink: 0,
                    backgroundColor: "#f0f0f0" // Fallback mientras carga
                  }}>
                    {/* Usar img normal para URLs de Viator/TripAdvisor */}
                    <img
                      src={tour.imageUrl}
                      alt={tour.name}
                      style={{ 
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transition: 'opacity 0.2s ease'
                      }}
                      loading="lazy"
                      onError={(e) => {
                        // Fallback a placeholder si falla la imagen
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.style.backgroundColor = '#e0e0e0';
                          parent.style.display = 'flex';
                          parent.style.alignItems = 'center';
                          parent.style.justifyContent = 'center';
                          parent.innerHTML = '<span style="font-size: 20px;">🎫</span>';
                        }
                      }}
                    />
                  </div>
                )}
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#333",
                    marginBottom: "4px",
                    lineHeight: 1.3
                  }}>
                    {tour.name}
                  </div>
                  <div style={{
                    fontSize: "12px",
                    color: "#666",
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap"
                  }}>
                    <span style={{ color: "#e91e63", fontWeight: 600 }}>
                      ${tour.price} {tour.currency}
                    </span>
                    <span>{tour.duration}</span>
                    {tour.rating > 0 && (
                      <span>⭐ {tour.rating.toFixed(1)} ({tour.reviewCount})</span>
                    )}
                  </div>
                  {tour.flags.includes('FREE_CANCELLATION') && (
                    <div style={{
                      fontSize: "11px",
                      color: "#28a745",
                      marginTop: "2px"
                    }}>
                      ✅ Free cancellation
                    </div>
                  )}
                </div>
                
                {isActive && (
                  <div style={{
                    marginLeft: "8px",
                    display: "flex"
                  }}>
                    <svg width={20} height={20} viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="8" stroke="#8f2fbf" strokeWidth="2"/>
                      <path d="M7 10.5L9.5 13 13 8.5" stroke="#8f2fbf" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </form>
  );
}