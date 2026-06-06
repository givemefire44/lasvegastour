"use client";
import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { client } from '@/sanity/lib/client';

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

interface MenuPage {
  title: string;
  slug: {
    current: string;
  };
  menuOrder?: number;
}

interface Category {
  title: string;
  slug: {
    current: string;
  };
  description?: string;
}

export default function MinimalHeader() {
  // Estados para busqueda modal
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  // Estados para dropdowns
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false);
  const [menuDropdownOpen, setMenuDropdownOpen] = useState(false);

  // Estado para renderizar solo en cliente
  const [isClient, setIsClient] = useState(false);

  // Estados para paginas y categorias
  const [menuPages, setMenuPages] = useState<MenuPage[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Solo renderizar en cliente para evitar hydration
  useEffect(() => {
    setIsClient(true);
    fetchMenuPages();
    fetchCategories();
  }, []);

  // Fetch paginas que deben aparecer en menu
  const fetchMenuPages = async () => {
    try {
      const query = `
        *[_type == "page" && showInMenu == true] | order(menuOrder asc, title asc) {
          title,
          slug,
          menuOrder
        }
      `;
      const pages = await client.fetch(query);
      setMenuPages(pages);
    } catch (error) {
      console.error('Error fetching menu pages:', error);
      setMenuPages([]);
    }
  };

  // Fetch categorias de tours
  const fetchCategories = async () => {
    try {
      const query = `
        *[_type == "category"] | order(title asc) {
          title,
          slug,
          description
        }
      `;
      const cats = await client.fetch(query);
      setCategories(cats);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
    }
  };

  // Buscar tours
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
    if (busqueda.trim()) {
      const searchUrl = `https://www.viator.com/s/?q=${encodeURIComponent(busqueda)}&pid=P00140156&mcid=42383&medium=search`;
      window.open(searchUrl, "_blank");
    }
  };

  // Cerrar dropdowns al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target as Element).closest('.dropdown-container')) {
        setLanguageDropdownOpen(false);
        setMenuDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus automatico en modal
  useEffect(() => {
    if (searchModalOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchModalOpen]);

  // Funcion para compartir
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'lasvegastour.com',
        text: "Look what I found - best Colosseum tours in Rome!",
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copiado al portapapeles!');
    }
  };

  // No renderizar nada hasta que este en el cliente
  if (!isClient) {
    return (
      <div style={{ height: '62px', width: '100%' }}>
        {/* Placeholder invisible para mantener espacio */}
      </div>
    );
  }

  return (
    <>
      {/* HEADER - SOLO EN CLIENTE */}
      <header className="site-header" style={{
        minHeight: '62px',
        background: '#fff',
        borderBottom: '1px solid #e0e0e0',
        position: 'relative',
        zIndex: 1000,
        width: '100%'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '6px 20px',
          minHeight: '62px',
          maxWidth: '1000px',
          margin: '0 auto'
        }}>

          {/* TOP ROW - dominio + acciones en la misma fila */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>

          {/* LOGO + CURATOR BADGE - Responsive */}
          <div className="logo-group" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link href="/" style={{
              fontSize: 'clamp(18px, 4vw, 23px)',
              fontWeight: '700',
              color: '#8816c0',
              textDecoration: 'none'
            }}>
              LasVegasTour.com
            </Link>

            {/* CURATOR BADGE - senal E-E-A-T (Intercoper Curator Team) */}
            <div className="curator-badge" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              paddingLeft: '12px',
              borderLeft: '1px solid #e0e0e0',
              lineHeight: 1.15
            }}>
              <span aria-hidden="true" style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#8816c0',
                flexShrink: 0
              }}></span>
              <span style={{ fontSize: '13px', color: '#555', whiteSpace: 'nowrap' }}>
                By <span style={{ fontWeight: 600 }}>Intercoper Curator Team</span>
                <br />
                <strong style={{ color: '#8816c0', fontWeight: 700 }}>Reviewed. Compared. Selected.</strong>
              </span>
            </div>

            {/* CURATOR - texto simple abajo del titulo, solo mobile */}
            <div className="curator-badge-mobile" style={{
              display: 'none',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap'
            }}>
              <span style={{ fontSize: '13px', color: '#555' }}>By <span style={{ fontWeight: 600 }}>Intercoper Curator Team</span></span>
              <span style={{ fontSize: '13px', color: '#8816c0', fontWeight: 700 }}>· Reviewed. Selected.</span>
            </div>
          </div>

          {/* ACCIONES - DESKTOP */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}
          className="desktop-actions"
          >

            {/* IDIOMAS */}
            <div className="dropdown-container" style={{ position: 'relative' }}>
              <button
                onClick={() => setLanguageDropdownOpen(!languageDropdownOpen)}
                style={{
                  background: 'transparent',
                  border: '1px solid #e0e0e0',
                  borderRadius: '20px',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px'
                }}
              >
                <span>EN</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
                  <polyline points="6,9 12,15 18,9"></polyline>
                </svg>
              </button>

              {languageDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  background: 'white',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  padding: '8px 0',
                  minWidth: '120px',
                  zIndex: 1001
                }}>
                  <button style={{ width: '100%', padding: '8px 16px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer' }}>
                    Espanol
                  </button>
                  <button style={{ width: '100%', padding: '8px 16px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer' }}>
                    English
                  </button>
                </div>
              )}
            </div>

            {/* BUSQUEDA */}
            <button
              onClick={() => setSearchModalOpen(true)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '4px',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#f5f5f5'}
              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="M21 21l-4.35-4.35"></path>
              </svg>
            </button>

            {/* COMPARTIR */}
            <div className="dropdown-container" style={{ position: 'relative' }}>
              <button
                onClick={handleShare}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '4px',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#f5f5f5'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
                  <circle cx="18" cy="5" r="3"></circle>
                  <circle cx="6" cy="12" r="3"></circle>
                  <circle cx="18" cy="19" r="3"></circle>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                </svg>
              </button>
            </div>

            {/* MENU HAMBURGER - CON CATEGORIAS Y PAGINAS */}
            <div className="dropdown-container" style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuDropdownOpen(!menuDropdownOpen)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '4px'
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </button>

              {menuDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  background: 'white',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  padding: '8px 0',
                  minWidth: '200px',
                  zIndex: 9999
                }}>
                  {/* CATEGORIAS DE TOURS */}
                  {categories.length > 0 && (
                    <>
                      <div style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color: '#8816c0',
                        padding: '8px 16px 4px',
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                      }}>
                        Tours
                      </div>
                      {categories.map((category) => (
                        <Link
                          key={category.slug.current}
                          href={`/tours/${category.slug.current}`}
                          style={{
                            display: 'block',
                            padding: '8px 16px 8px 32px',
                            textDecoration: 'none',
                            color: '#333',
                            fontSize: '14px',
                            transition: 'all 0.15s'
                          }}
                          onClick={() => setMenuDropdownOpen(false)}
                          onMouseOver={(e) => {
                            e.currentTarget.style.background = '#f8f5ff';
                            e.currentTarget.style.color = '#8816c0';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#333';
                          }}
                        >
                          {category.title}
                        </Link>
                      ))}
                      <div style={{ height: '1px', background: '#e0e0e0', margin: '8px 0' }}></div>
                    </>
                  )}

                  {/* PAGINAS ESTATICAS */}
                  {menuPages.length > 0 && (
                    <>
                      <div style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color: '#8816c0',
                        padding: '8px 16px 4px',
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                      }}>
                        Pages
                      </div>
                      <Link
                        href="/"
                        style={{
                          display: 'block',
                          padding: '8px 16px 8px 32px',
                          textDecoration: 'none',
                          color: '#333',
                          fontSize: '14px',
                          transition: 'all 0.15s'
                        }}
                        onClick={() => setMenuDropdownOpen(false)}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = '#f8f5ff';
                          e.currentTarget.style.color = '#8816c0';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = '#333';
                        }}
                      >
                        Home
                      </Link>
                      {menuPages.map((page) => (
                        <Link
                          key={page.slug.current}
                          href={`/${page.slug.current}`}
                          style={{
                            display: 'block',
                            padding: '8px 16px 8px 32px',
                            textDecoration: 'none',
                            color: '#333',
                            fontSize: '14px',
                            transition: 'all 0.15s'
                          }}
                          onClick={() => setMenuDropdownOpen(false)}
                          onMouseOver={(e) => {
                            e.currentTarget.style.background = '#f8f5ff';
                            e.currentTarget.style.color = '#8816c0';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#333';
                          }}
                        >
                          {page.title}
                        </Link>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ACCIONES - MOBILE */}
          <div style={{
            display: 'none',
            alignItems: 'center',
            gap: '12px'
          }}
          className="mobile-actions"
          >
            <button
              onClick={handleShare}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '4px'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
            </button>

            <div className="dropdown-container" style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuDropdownOpen(!menuDropdownOpen)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '4px'
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </button>

              {menuDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: '-10px',
                  background: 'white',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  padding: '8px 0',
                  minWidth: '240px',
                  maxHeight: '80vh',
                  overflowY: 'auto',
                  zIndex: 9999
                }}>
                  {/* IDIOMAS */}
                  <div style={{ padding: '8px 16px', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button style={{ padding: '4px 8px', border: '1px solid #e0e0e0', borderRadius: '4px', background: 'transparent', cursor: 'pointer', fontSize: '12px' }}>
                        ES
                      </button>
                      <button style={{ padding: '4px 8px', border: '1px solid #8816c0', borderRadius: '4px', background: '#8816c0', color: 'white', cursor: 'pointer', fontSize: '12px' }}>
                        EN
                      </button>
                    </div>
                  </div>

                  {/* BUSQUEDA */}
                  <button
                    onClick={() => {
                      setSearchModalOpen(true);
                      setMenuDropdownOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 16px',
                      border: 'none',
                      background: 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
                      <circle cx="11" cy="11" r="8"></circle>
                      <path d="M21 21l-4.35-4.35"></path>
                    </svg>
                    Search Tours
                  </button>

                  {/* COMPARTIR */}
                  <button
                    onClick={() => {
                      handleShare();
                      setMenuDropdownOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 16px',
                      border: 'none',
                      background: 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
                      <circle cx="18" cy="5" r="3"></circle>
                      <circle cx="6" cy="12" r="3"></circle>
                      <circle cx="18" cy="19" r="3"></circle>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                    </svg>
                    Share Page
                  </button>

                  <div style={{ height: '1px', background: '#f0f0f0', margin: '8px 0' }}></div>

                  {/* CATEGORIAS DE TOURS - MOBILE */}
                  {categories.length > 0 && (
                    <>
                      <div style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color: '#8816c0',
                        padding: '8px 16px 4px',
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                      }}>
                        Tours
                      </div>
                      {categories.map((category) => (
                        <Link
                          key={category.slug.current}
                          href={`/tours/${category.slug.current}`}
                          style={{
                            display: 'block',
                            padding: '8px 16px 8px 32px',
                            textDecoration: 'none',
                            color: '#333',
                            fontSize: '14px'
                          }}
                          onClick={() => setMenuDropdownOpen(false)}
                        >
                          {category.title}
                        </Link>
                      ))}
                      <div style={{ height: '1px', background: '#f0f0f0', margin: '8px 0' }}></div>
                    </>
                  )}

                  {/* PAGINAS ESTATICAS - MOBILE */}
                  {menuPages.length > 0 && (
                    <>
                      <div style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color: '#8816c0',
                        padding: '8px 16px 4px',
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                      }}>
                        Pages
                      </div>
                      <Link
                        href="/"
                        style={{
                          display: 'block',
                          padding: '8px 16px 8px 32px',
                          textDecoration: 'none',
                          color: '#333',
                          fontSize: '14px'
                        }}
                        onClick={() => setMenuDropdownOpen(false)}
                      >
                        Home
                      </Link>
                      {menuPages.map((page) => (
                        <Link
                          key={page.slug.current}
                          href={`/${page.slug.current}`}
                          style={{
                            display: 'block',
                            padding: '8px 16px 8px 32px',
                            textDecoration: 'none',
                            color: '#333',
                            fontSize: '14px'
                          }}
                          onClick={() => setMenuDropdownOpen(false)}
                        >
                          {page.title}
                        </Link>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
      </header>

      {/* MODAL DE BUSQUEDA - SIN CAMBIOS */}
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

            {/* Input de busqueda */}
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
                  Searching...
                </div>
              )}

              {!loading && tours.length === 0 && busqueda.length >= 3 && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                  No tours found
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
                          <span>{tour.rating.toFixed(1)}</span>
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

      <style jsx>{`
        @media (max-width: 768px) {
          .site-header {
            margin-bottom: 12px !important;
          }
          .desktop-actions {
            display: none !important;
          }
          .mobile-actions {
            display: flex !important;
          }
          .curator-badge {
            display: none !important;
          }
          .curator-badge-mobile {
            display: flex !important;
          }
          .logo-group {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 5px !important;
          }
        }

        @media (min-width: 769px) {
          .desktop-actions {
            display: flex !important;
          }
          .mobile-actions {
            display: none !important;
          }
          .curator-badge-mobile {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
